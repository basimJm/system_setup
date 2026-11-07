import { ERROR_CODES, SdkError } from '../src';
import {
  FcmPushSender,
  buildFcmMessage,
  fcmCodeOf,
  normalizeFcmError,
  type FcmBatchResponse,
  type FcmMessaging,
  type FcmMulticastMessage,
} from '../src/adapters/fcm';

type Entry = FcmBatchResponse['responses'][number];

const messagingOf = (
  answer: (message: FcmMulticastMessage) => FcmBatchResponse | Error,
  calls: { message: FcmMulticastMessage; dryRun: boolean | undefined }[] = [],
): FcmMessaging => ({
  sendEachForMulticast: (message, dryRun) => {
    calls.push({ message, dryRun });
    const result = answer(message);
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  },
});

const failure = (code: string, message = ''): Entry => ({ success: false, error: { code, message } });
const sender = (entries: Entry[]): FcmPushSender =>
  new FcmPushSender({ messaging: () => Promise.resolve(messagingOf(() => ({ responses: entries }))) });

describe('buildFcmMessage', () => {
  it('maps a full message for both platforms', () => {
    expect(
      buildFcmMessage({
        tokens: ['a'],
        title: 't',
        body: 'b',
        data: { k: 'v' },
        priority: 'high',
        collapseKey: 'c',
      }),
    ).toEqual({
      tokens: ['a'],
      data: { k: 'v' },
      notification: { title: 't', body: 'b' },
      android: { priority: 'high', collapseKey: 'c' },
      apns: { headers: { 'apns-priority': '10', 'apns-collapse-id': 'c' }, payload: { aps: {} } },
    });
  });

  it('builds a data-only message with normal priority', () => {
    const message = buildFcmMessage({ tokens: ['a'], data: { k: 'v' } });
    expect(message.notification).toBeUndefined();
    expect(message.android).toEqual({ priority: 'normal' });
    expect(message.apns.headers).toEqual({ 'apns-priority': '5' });
  });

  it('fills the missing half of a notification and drops empty data', () => {
    expect(buildFcmMessage({ tokens: ['a'], body: 'b' }).notification).toEqual({ title: '', body: 'b' });
    expect(buildFcmMessage({ tokens: ['a'], title: 't' }).notification).toEqual({ title: 't', body: '' });
    expect(buildFcmMessage({ tokens: ['a'], title: 't' }).data).toBeUndefined();
  });
});

describe('FcmPushSender', () => {
  it('maps every per-token answer', async () => {
    const results = await sender([
      { success: true },
      failure('messaging/registration-token-not-registered'),
      failure('messaging/invalid-argument', 'The registration token is not a valid FCM token'),
      failure('messaging/server-unavailable'),
      failure('messaging/message-rate-exceeded'),
      failure('messaging/invalid-argument', 'payload too big'),
      { success: false },
    ]).send({ tokens: ['t1', 't2', 't3', 't4', 't5', 't6', 't7'], body: 'b' });
    expect(results.map((r) => r.status)).toEqual([
      'SENT',
      'INVALID_TOKEN',
      'INVALID_TOKEN',
      'RETRYABLE',
      'RETRYABLE',
      'FAILED',
      'FAILED',
    ]);
    expect(results[1]?.errorCode).toBe('messaging/registration-token-not-registered');
  });

  it('throws a typed error when a token answer is an auth error', async () => {
    await expect(
      sender([failure('messaging/third-party-auth-error')]).send({ tokens: ['t'], body: 'b' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.AUTH_FAILED });
  });

  it('rejects an answer with a different count, as retryable', async () => {
    await expect(sender([]).send({ tokens: ['t'], body: 'b' })).rejects.toMatchObject({
      code: ERROR_CODES.MALFORMED_RESPONSE,
      retryable: true,
    });
  });

  it('passes dryRun on, defaults it to false and normalizes whole-call failures', async () => {
    const calls: { message: FcmMulticastMessage; dryRun: boolean | undefined }[] = [];
    const ok = messagingOf(() => ({ responses: [{ success: true }] }), calls);
    await new FcmPushSender({ messaging: () => Promise.resolve(ok), dryRun: true }).send({ tokens: ['t'], body: 'b' });
    await new FcmPushSender({ messaging: () => Promise.resolve(ok) }).send({ tokens: ['t'], body: 'b' });
    expect(calls.map((c) => c.dryRun)).toEqual([true, false]);
    const down = new FcmPushSender({
      messaging: () => Promise.resolve(messagingOf(() => Object.assign(new Error('x'), { code: 'messaging/server-unavailable' }))),
    });
    await expect(down.send({ tokens: ['t'], body: 'b' })).rejects.toMatchObject({
      code: ERROR_CODES.UNAVAILABLE,
      retryable: true,
    });
  });

  it('closes through the injected close function, or does nothing', async () => {
    let closed = 0;
    const close = (): Promise<void> => {
      closed += 1;
      return Promise.resolve();
    };
    await new FcmPushSender({ messaging: () => Promise.reject(new Error('unused')), close }).close();
    await new FcmPushSender({ messaging: () => Promise.reject(new Error('unused')) }).close();
    expect(closed).toBe(1);
  });
});

describe('normalizeFcmError', () => {
  const code = (value: string): SdkError => normalizeFcmError({ code: value });

  it('maps every class of failure', () => {
    expect(code('app/invalid-credential')).toMatchObject({ code: ERROR_CODES.AUTH_FAILED, retryable: false });
    expect(code('messaging/message-rate-exceeded')).toMatchObject({ code: ERROR_CODES.RATE_LIMITED, retryable: true });
    expect(code('messaging/invalid-payload')).toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED, retryable: false });
    expect(code('messaging/internal-error')).toMatchObject({ code: ERROR_CODES.UNAVAILABLE, retryable: true });
    expect(code('')).toMatchObject({ code: ERROR_CODES.NETWORK_ERROR, retryable: true });
    expect(code('something/else')).toMatchObject({ code: ERROR_CODES.UNKNOWN, retryable: false });
  });

  it('keeps an SdkError and reads the code from errorInfo, a plain code or nothing', () => {
    const typed = new SdkError(ERROR_CODES.TIMEOUT, 'late');
    expect(normalizeFcmError(typed)).toBe(typed);
    expect(fcmCodeOf({ errorInfo: { code: 'a/b' }, code: 'c' })).toBe('a/b');
    expect(fcmCodeOf({ code: 'c' })).toBe('c');
    expect(fcmCodeOf({ code: 5 })).toBe('');
    expect(fcmCodeOf('text')).toBe('');
    expect(fcmCodeOf(null)).toBe('');
  });
});
