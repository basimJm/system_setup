import { createHmac, timingSafeEqual } from 'node:crypto';
import { MS_PER_SECOND } from './constants/defaults';
import { ERROR_CODES, WEBHOOK_EVENTS, WIRE, type WebhookEventType } from './constants/payments';
import { SdkError } from './errors';
import type { WebhookEvent, WebhookInput } from './types';

/** Body of a webhook on the wire. */
export interface WebhookBody {
  readonly eventId: string;
  readonly type: string;
  readonly sessionId: string;
  readonly occurredAt: string;
  readonly data?: unknown;
}

const hmac = (secret: string, timestamp: string, rawBody: string): string =>
  createHmac('sha256', secret)
    .update(`${timestamp}${WIRE.signaturePayloadSeparator}${rawBody}`)
    .digest('hex');

/** `x-signature: t=<unix seconds>,v1=<hmac>` over `<t>.<rawBody>`. */
export const signWebhook = (secret: string, rawBody: string, now: Date): Record<string, string> => {
  const timestamp = String(Math.floor(now.getTime() / MS_PER_SECOND));
  const parts = [
    `${WIRE.signatureTimestamp}=${timestamp}`,
    `${WIRE.signatureVersion}=${hmac(secret, timestamp, rawBody)}`,
  ];
  return {
    [WIRE.headers.signature]: parts.join(WIRE.signatureSeparator),
    [WIRE.headers.contentType]: WIRE.json,
  };
};

const headerValue = (input: WebhookInput, name: string): string | undefined => {
  const entry = Object.entries(input.headers).find(([key]) => key.toLowerCase() === name);
  const value = entry?.[1];
  return Array.isArray(value) ? value[0] : value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const invalid = (message: string): SdkError => new SdkError(ERROR_CODES.WEBHOOK_INVALID, message);

const parseSignature = (header: string): { timestamp: string; signature: string } => {
  const fields = new Map(
    header.split(WIRE.signatureSeparator).map((part) => {
      const index = part.indexOf('=');
      return [part.slice(0, index).trim(), part.slice(index + 1).trim()] as const;
    }),
  );
  const timestamp = fields.get(WIRE.signatureTimestamp);
  const signature = fields.get(WIRE.signatureVersion);
  if (timestamp === undefined || signature === undefined || !/^\d+$/.test(timestamp))
    throw invalid('signature header is malformed');
  return { timestamp, signature };
};

const eventType = (type: string): WebhookEventType =>
  (WEBHOOK_EVENTS as readonly string[]).includes(type) ? (type as WebhookEventType) : 'UNKNOWN';

/** Verifies signature + freshness, then normalises the body. Unknown types become `UNKNOWN`. */
export const verifyWebhook = (
  secret: string,
  input: WebhookInput,
  now: Date,
  toleranceSec: number,
): WebhookEvent => {
  const header = headerValue(input, WIRE.headers.signature);
  if (header === undefined) throw invalid('signature header is missing');
  const { timestamp, signature } = parseSignature(header);
  const rawBody =
    typeof input.rawBody === 'string' ? input.rawBody : input.rawBody.toString('utf8');
  const expected = Buffer.from(hmac(secret, timestamp, rawBody), 'hex');
  const actual = Buffer.from(signature, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new SdkError(ERROR_CODES.AUTH_FAILED, 'webhook signature does not match');
  const age = Math.abs(now.getTime() / MS_PER_SECOND - Number(timestamp));
  if (age > toleranceSec) throw invalid('webhook timestamp is outside the tolerance');
  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch (error) {
    throw new SdkError(ERROR_CODES.MALFORMED_RESPONSE, 'webhook body is not JSON', {
      cause: error,
    });
  }
  if (
    typeof body.eventId !== 'string' ||
    typeof body.sessionId !== 'string' ||
    typeof body.type !== 'string'
  )
    throw invalid('webhook body lacks eventId, type or sessionId');
  const occurredAt = new Date(body.occurredAt);
  return {
    eventId: body.eventId,
    type: eventType(body.type),
    sessionId: body.sessionId,
    occurredAt: Number.isNaN(occurredAt.getTime()) ? now : occurredAt,
    data: isRecord(body.data) ? body.data : {},
  };
};
