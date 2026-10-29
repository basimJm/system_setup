import { SETTING_LIST_SEPARATOR } from '@/constants/settings';
import type { SettingDefinition } from './registry';

export type SettingError = 'required' | 'integer' | 'min' | 'max' | 'list';
export type SettingParse =
  | { readonly ok: true; readonly value: number | readonly number[] }
  | { readonly ok: false; readonly error: SettingError };

const WHOLE = /^\d+$/;

function parseInt1(text: string, def: SettingDefinition): SettingParse {
  if (text === '') return { ok: false, error: 'required' };
  if (!WHOLE.test(text)) return { ok: false, error: 'integer' };
  const n = Number(text);
  if (n < def.min) return { ok: false, error: 'min' };
  if (n > def.max) return { ok: false, error: 'max' };
  return { ok: true, value: n };
}

/** Checks what the admin typed against the setting's kind and bounds; lists are comma separated, largest first. */
export function parseSetting(text: string, def: SettingDefinition): SettingParse {
  const trimmed = text.trim();
  if (def.kind === 'int') return parseInt1(trimmed, def);
  const parts = trimmed
    .split(SETTING_LIST_SEPARATOR)
    .map((p) => p.trim())
    .filter((p) => p !== '');
  if (parts.length === 0) return { ok: false, error: 'required' };
  const values: number[] = [];
  for (const part of parts) {
    const one = parseInt1(part, def);
    if (!one.ok) return one;
    values.push(one.value as number);
  }
  if (new Set(values).size !== values.length) return { ok: false, error: 'list' };
  return { ok: true, value: values.sort((a, b) => b - a) };
}

/** Text shown in the field for a stored value. */
export function settingToText(value: unknown): string {
  if (Array.isArray(value)) return value.join(`${SETTING_LIST_SEPARATOR} `);
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  return '';
}

export const sameSettingValue = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
