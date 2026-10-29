import {
  EMAIL_MAX_RECIPIENTS,
  EMAIL_PATTERN,
  IDEMPOTENCY_KEY_PATTERN,
  PUSH_MAX_TOKENS_PER_REQUEST,
  PUSH_TOPIC_PATTERN,
} from '../../constants/providers';
import type { EmailRequest, PushRequest } from './types';

const fail = (message: string): never => {
  throw new RangeError(message);
};

export const assertIdempotencyKey = (key: string): void => {
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) fail('invalid idempotency key');
};

/** Caller bugs (the notification service builds requests), so `RangeError`. */
export const assertPushRequest = ({ target, message, idempotencyKey }: PushRequest): void => {
  assertIdempotencyKey(idempotencyKey);
  if ('tokens' in target) {
    if (target.tokens.length === 0) fail('no push tokens');
    if (target.tokens.length > PUSH_MAX_TOKENS_PER_REQUEST) fail('too many push tokens');
    if (target.tokens.some((token) => token.trim() === '')) fail('empty push token');
    if (new Set(target.tokens).size !== target.tokens.length) fail('duplicate push token');
  } else if (!PUSH_TOPIC_PATTERN.test(target.topic)) {
    fail('invalid push topic');
  }
  const hasText = (value: string | undefined): boolean =>
    value !== undefined && value.trim() !== '';
  if (message.kind === 'VISIBLE' && (!hasText(message.title) || !hasText(message.body))) {
    fail('a visible push needs a title and a body');
  }
  if (message.kind === 'DATA_ONLY') {
    if (message.title !== undefined || message.body !== undefined)
      fail('a data-only push has no text');
    if (message.data === undefined || Object.keys(message.data).length === 0) {
      fail('a data-only push needs data');
    }
  }
  if (message.badge !== undefined && (!Number.isSafeInteger(message.badge) || message.badge < 0)) {
    fail('badge must be a whole number from 0');
  }
};

export const assertEmailRequest = ({ to, subject, text, idempotencyKey }: EmailRequest): void => {
  assertIdempotencyKey(idempotencyKey);
  if (to.length === 0 || to.length > EMAIL_MAX_RECIPIENTS) fail('invalid recipient count');
  if (to.some((address) => !EMAIL_PATTERN.test(address))) fail('invalid email address');
  if (subject.trim() === '' || text.trim() === '') fail('an email needs a subject and a text');
};
