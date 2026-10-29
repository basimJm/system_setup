import {
  DEFAULTS,
  EMAIL_PATTERN,
  MAX_RECIPIENTS,
  MAX_SUBJECT_LENGTH,
  PRIORITIES,
} from './constants/notifications';
import { validationError } from './errors';
import type { EmailMessage, PushMessage } from './types';

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** Returns the distinct, non-empty tokens in order; throws when there is nothing to send to. */
export const distinctTokens = (message: PushMessage): string[] => {
  if (!Array.isArray(message.tokens)) throw validationError('tokens must be an array');
  const tokens = [...new Set(message.tokens.filter(isText))];
  if (tokens.length === 0) throw validationError('tokens must contain at least one token');
  return tokens;
};

export const assertPushMessage = (message: PushMessage): void => {
  if (message.title === undefined && message.body === undefined && message.data === undefined)
    throw validationError('a push needs a title, a body or data');
  if (
    message.priority !== undefined &&
    !(PRIORITIES as readonly string[]).includes(message.priority)
  )
    throw validationError('priority must be high or normal');
  if (message.data !== undefined) {
    const entries = Object.entries(message.data);
    if (entries.some(([, value]) => typeof value !== 'string'))
      throw validationError('data values must be strings');
    if (Buffer.byteLength(JSON.stringify(message.data)) > DEFAULTS.maxDataBytes)
      throw validationError('data exceeds the size limit');
  }
};

export const assertEmailMessage = (message: EmailMessage): void => {
  if (!Array.isArray(message.to) || message.to.length === 0 || message.to.length > MAX_RECIPIENTS)
    throw validationError('to must list 1 to 50 recipients');
  if (message.to.some((address) => !isText(address) || !EMAIL_PATTERN.test(address)))
    throw validationError('to contains an invalid address');
  if (!isText(message.subject) || message.subject.length > MAX_SUBJECT_LENGTH)
    throw validationError('subject is required and bounded');
  if (!isText(message.text)) throw validationError('text is required');
  if (message.replyTo !== undefined && !EMAIL_PATTERN.test(message.replyTo))
    throw validationError('replyTo is not a valid address');
};

export const assertIdempotencyKey = (key: string | undefined): void => {
  if (key !== undefined && !isText(key))
    throw validationError('idempotencyKey must be a non-empty string');
};
