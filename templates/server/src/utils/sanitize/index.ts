import {
  FORBIDDEN_KEY_CHARACTER,
  FORBIDDEN_KEY_PREFIX,
  HTML_COMMENT,
  HTML_TAG,
  MAX_SANITIZE_DEPTH,
  MAX_STRIP_PASSES,
  PROTOTYPE_KEYS,
  SCRIPT_OR_STYLE_BLOCK,
} from '../../constants/security';
import { SENSITIVE_KEYS } from '../../constants/logging';
import { ValidationError } from '../errors';

/** Removes script/style blocks, comments and tags from text (repeats until stable). */
export const stripHtml = (text: string): string => {
  let current = text;
  for (let pass = 0; pass < MAX_STRIP_PASSES; pass += 1) {
    const next = current
      .replace(SCRIPT_OR_STYLE_BLOCK, '')
      .replace(HTML_COMMENT, '')
      .replace(HTML_TAG, '');
    if (next === current) break;
    current = next;
  }
  return current;
};

const isForbiddenKey = (key: string): boolean =>
  key.startsWith(FORBIDDEN_KEY_PREFIX) ||
  key.includes(FORBIDDEN_KEY_CHARACTER) ||
  PROTOTYPE_KEYS.has(key);

const isSecretKey = (key: string): boolean =>
  SENSITIVE_KEYS.has(key.toLowerCase().replace(/[_-]/g, ''));

const sanitizeNode = (value: unknown, depth: number, stripMarkup: boolean): unknown => {
  if (depth > MAX_SANITIZE_DEPTH) throw new ValidationError();
  if (typeof value === 'string') return stripMarkup ? stripHtml(value) : value;
  if (Array.isArray(value)) return value.map((item) => sanitizeNode(item, depth + 1, stripMarkup));
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (isForbiddenKey(key)) continue;
      // Secret-like fields (passwords, tokens) are never rewritten, only checked for operators.
      result[key] = sanitizeNode(child, depth + 1, stripMarkup && !isSecretKey(key));
    }
    return result;
  }
  return value;
};

/**
 * Deep-copies request input, dropping operator/prototype keys (NoSQL injection, prototype
 * pollution) and stripping HTML from text (stored XSS). Throws `ValidationError` when nested too deep.
 */
export const sanitizeInput = (value: unknown): unknown => sanitizeNode(value, 0, true);
