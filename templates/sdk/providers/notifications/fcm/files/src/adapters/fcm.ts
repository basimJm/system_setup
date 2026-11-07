import { KERNEL_ERROR_CODES } from '../constants/codes';
import { SdkError } from '../errors';
import type { PushMessage, PushSender, TokenResult } from '../types';

/** The slice of firebase-admin `Messaging` used here (injectable for tests and other transports). */
export interface FcmMulticastMessage {
  readonly tokens: string[];
  readonly data?: Record<string, string>;
  readonly notification?: { readonly title: string; readonly body: string };
  readonly android: { readonly priority: 'high' | 'normal'; readonly collapseKey?: string };
  readonly apns: { readonly headers: Record<string, string>; readonly payload: { aps: object } };
}

export interface FcmBatchResponse {
  readonly responses: readonly {
    readonly success: boolean;
    readonly error?: { readonly code?: string; readonly message?: string } | undefined;
  }[];
}

export interface FcmMessaging {
  sendEachForMulticast(message: FcmMulticastMessage, dryRun?: boolean): Promise<FcmBatchResponse>;
}

export interface FcmSenderOptions {
  readonly messaging: () => Promise<FcmMessaging>;
  /** FCM validates the message but delivers nothing (smoke tests). */
  readonly dryRun?: boolean;
  readonly close?: () => Promise<void>;
}

const FCM_CODES = {
  invalidToken: [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
  ],
  /** FCM answers a malformed token with `invalid-argument`; the message tells it from a bad payload. */
  tokenMessage: /registration token/i,
  payloadInvalid: [
    'messaging/invalid-argument',
    'messaging/invalid-payload',
    'messaging/payload-size-limit-exceeded',
  ],
  auth: [
    'messaging/authentication-error',
    'messaging/third-party-auth-error',
    'messaging/mismatched-credential',
    'messaging/invalid-apns-credentials',
    'app/invalid-credential',
  ],
  rateLimited: [
    'messaging/message-rate-exceeded',
    'messaging/device-message-rate-exceeded',
    'messaging/topics-message-rate-exceeded',
  ],
  retryable: [
    'messaging/internal-error',
    'messaging/server-unavailable',
    'messaging/unknown-error',
    'app/network-error',
  ],
} as const;

const APNS_PRIORITY = { high: '10', normal: '5' } as const;

const has = (list: readonly string[], code: string): boolean => list.includes(code);

/** `code` of a firebase-admin error, whichever level carries it ('' when there is none). */
export const fcmCodeOf = (error: unknown): string => {
  if (typeof error !== 'object' || error === null) return '';
  const record = error as { code?: unknown; errorInfo?: { code?: unknown } };
  if (typeof record.errorInfo?.code === 'string') return record.errorInfo.code;
  return typeof record.code === 'string' ? record.code : '';
};

/** Turns a thrown FCM or network error into the SDK's typed error (whole-call failures). */
export const normalizeFcmError = (error: unknown): SdkError => {
  if (error instanceof SdkError) return error;
  const code = fcmCodeOf(error);
  const base = { cause: error, details: { vendorCode: code } };
  if (has(FCM_CODES.auth, code))
    return new SdkError(KERNEL_ERROR_CODES.AUTH_FAILED, 'FCM rejected the credentials', base);
  if (has(FCM_CODES.rateLimited, code))
    return new SdkError(KERNEL_ERROR_CODES.RATE_LIMITED, 'FCM rate limit reached', {
      ...base,
      retryable: true,
    });
  if (has(FCM_CODES.payloadInvalid, code))
    return new SdkError(KERNEL_ERROR_CODES.VALIDATION_FAILED, 'FCM rejected the payload', base);
  if (code === '' || has(FCM_CODES.retryable, code))
    // No code at all means FCM never answered (DNS, socket, TLS): transient.
    return new SdkError(
      code === '' ? KERNEL_ERROR_CODES.NETWORK_ERROR : KERNEL_ERROR_CODES.UNAVAILABLE,
      'FCM is unavailable',
      { ...base, retryable: true },
    );
  return new SdkError(KERNEL_ERROR_CODES.UNKNOWN, 'unexpected FCM error', base);
};

/** Vendor-neutral push message → FCM multicast message for Android and iOS. */
export const buildFcmMessage = (message: PushMessage): FcmMulticastMessage => {
  const priority = message.priority === 'high' ? 'high' : 'normal';
  const headers: Record<string, string> = { 'apns-priority': APNS_PRIORITY[priority] };
  if (message.collapseKey !== undefined) headers['apns-collapse-id'] = message.collapseKey;
  return {
    tokens: [...message.tokens],
    ...(message.data === undefined ? {} : { data: { ...message.data } }),
    ...(message.title === undefined && message.body === undefined
      ? {}
      : { notification: { title: message.title ?? '', body: message.body ?? '' } }),
    android: {
      priority,
      ...(message.collapseKey === undefined ? {} : { collapseKey: message.collapseKey }),
    },
    apns: { headers, payload: { aps: {} } },
  };
};

/** One token's outcome; an auth error is a whole-call failure and throws. */
const tokenResult = (
  token: string,
  entry: FcmBatchResponse['responses'][number] | undefined,
): TokenResult => {
  if (entry?.success === true) return { token, status: 'SENT' };
  const code = entry?.error?.code ?? '';
  if (has(FCM_CODES.auth, code)) throw normalizeFcmError({ code });
  const tokenProblem =
    has(FCM_CODES.invalidToken, code) ||
    (code === 'messaging/invalid-argument' &&
      FCM_CODES.tokenMessage.test(entry?.error?.message ?? ''));
  if (tokenProblem) return { token, status: 'INVALID_TOKEN', errorCode: code };
  if (has(FCM_CODES.retryable, code) || has(FCM_CODES.rateLimited, code))
    return { token, status: 'RETRYABLE', errorCode: code };
  return { token, status: 'FAILED', errorCode: code };
};

/** Push through Firebase Cloud Messaging. The notifier chunks tokens and retries `RETRYABLE` ones. */
export class FcmPushSender implements PushSender {
  readonly name = 'fcm';

  constructor(private readonly options: FcmSenderOptions) {}

  async send(message: PushMessage): Promise<readonly TokenResult[]> {
    const messaging = await this.options.messaging();
    let response: FcmBatchResponse;
    try {
      response = await messaging.sendEachForMulticast(
        buildFcmMessage(message),
        this.options.dryRun ?? false,
      );
    } catch (error) {
      throw normalizeFcmError(error);
    }
    if (response.responses.length !== message.tokens.length)
      throw new SdkError(KERNEL_ERROR_CODES.MALFORMED_RESPONSE, 'FCM answered a different count', {
        retryable: true,
      });
    return message.tokens.map((token, index) => tokenResult(token, response.responses[index]));
  }

  async close(): Promise<void> {
    await this.options.close?.();
  }
}
