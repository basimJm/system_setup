import { FakeEmailSender, FakePushSender } from '../src/adapters/fake';
import { MemoryIdempotencyStore } from '../src/adapters/memory-idempotency';
import { resolveConfig } from '../src/config/options';
import { ERROR_CODES } from '../src/constants/notifications';
import { SdkError } from '../src/errors';
import { NotifierService } from '../src/notifier';
import { createNotifications, type Notifications } from '../src/notifications';
import type { Logger, PushSender } from '../src';

const instant = { sleep: () => Promise.resolve(), random: () => 0.5 };
const email = { to: ['a@b.co'], subject: 's', text: 't' };

interface Harness {
  notifier: Notifications;
  push: FakePushSender;
  mail: FakeEmailSender;
  logs: unknown[][];
}

const harness = (overrides: Record<string, unknown> = {}): Harness => {
  const logs: unknown[][] = [];
  const logger: Logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: (...a) => logs.push(a),
    error: () => undefined,
  };
  const push = new FakePushSender();
  const mail = new FakeEmailSender();
  const config = resolveConfig({
    environment: 'dev',
    push: { provider: 'custom' },
    email: { provider: 'custom' },
    pushSender: push,
    emailSender: mail,
    logger,
    maxTokensPerSend: 2,
    retry: { maxAttempts: 3 },
    timeoutMs: 50,
    ...overrides,
  });
  const service = new NotifierService(config, {
    pushSender: push,
    emailSender: mail,
    idempotencyStore: new MemoryIdempotencyStore(),
    retryDeps: instant,
  });
  return {
    notifier: Object.assign(service, { pushSender: push, emailSender: mail }),
    push,
    mail,
    logs,
  };
};

describe('sendPush', () => {
  it('chunks, de-duplicates, retries retryable tokens and reports invalid ones', async () => {
    const h = harness();
    h.push.invalid.add('bad');
    h.push.flaky.add('slow');
    const report = await h.notifier.sendPush({
      tokens: ['a', 'b', 'bad', 'slow', 'a'],
      body: 'hi',
    });
    expect(report).toEqual({
      results: [
        { token: 'a', status: 'SENT' },
        { token: 'b', status: 'SENT' },
        { token: 'bad', status: 'INVALID_TOKEN', errorCode: 'unregistered' },
        { token: 'slow', status: 'SENT' },
      ],
      invalidTokens: ['bad'],
      sent: 3,
      failed: 0,
      duplicate: false,
    });
    expect(h.push.sent.map((m) => m.tokens)).toEqual([['a', 'b'], ['bad', 'slow'], ['slow']]);
  });

  it('gives up on tokens that stay retryable and marks unknown tokens failed', async () => {
    const h = harness({ retry: { maxAttempts: 2 } });
    const stubborn: PushSender = {
      name: 'stub',
      send: (m) =>
        Promise.resolve(
          m.tokens
            .filter((t) => t === 'x')
            .map((token) => ({ token, status: 'RETRYABLE' as const })),
        ),
    };
    const service = new NotifierService(
      resolveConfig({
        environment: 'dev',
        push: { provider: 'custom' },
        pushSender: stubborn,
        retry: { maxAttempts: 2 },
      }),
      { pushSender: stubborn, idempotencyStore: new MemoryIdempotencyStore(), retryDeps: instant },
    );
    const report = await service.sendPush({ tokens: ['x', 'y'], title: 't' });
    expect(report.results).toEqual([
      { token: 'x', status: 'FAILED', errorCode: undefined },
      { token: 'y', status: 'FAILED' },
    ]);
    expect(report).toMatchObject({ sent: 0, failed: 2, invalidTokens: [] });
    expect(h.logs).toEqual([]);
  });

  it('retries whole-call failures, then fails with PUSH_FAILED', async () => {
    const h = harness();
    h.push.failWith = new Error('vendor down');
    await expect(h.notifier.sendPush({ tokens: ['a'], body: 'b' })).rejects.toMatchObject({
      code: ERROR_CODES.PUSH_FAILED,
      retryable: true,
    });
    expect(h.logs).toHaveLength(3);
    expect(h.logs[0]).toEqual([
      'push call failed',
      { sender: 'fake', reason: ERROR_CODES.PUSH_FAILED },
    ]);
    h.push.failWith = new SdkError('X_AUTH', 'bad key');
    await expect(h.notifier.sendPush({ tokens: ['a'], body: 'b' })).rejects.toMatchObject({
      code: 'X_AUTH',
    });
    expect(h.logs).toHaveLength(4);
  });

  it('wraps non-Error rejections', async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- vendors do throw strings
    const odd: PushSender = { name: 'odd', send: () => Promise.reject('text') };
    const service = new NotifierService(
      resolveConfig({
        environment: 'dev',
        push: { provider: 'custom' },
        pushSender: odd,
        retry: { maxAttempts: 1 },
      }),
      { pushSender: odd, idempotencyStore: new MemoryIdempotencyStore(), retryDeps: instant },
    );
    await expect(service.sendPush({ tokens: ['a'], body: 'b' })).rejects.toMatchObject({
      code: ERROR_CODES.PUSH_FAILED,
      message: 'text',
    });
  });

  it('times out a hanging sender', async () => {
    const hanging: PushSender = { name: 'hang', send: () => new Promise(() => undefined) };
    const service = new NotifierService(
      resolveConfig({
        environment: 'dev',
        push: { provider: 'custom' },
        pushSender: hanging,
        timeoutMs: 1,
        retry: { maxAttempts: 1 },
      }),
      { pushSender: hanging, idempotencyStore: new MemoryIdempotencyStore(), retryDeps: instant },
    );
    await expect(service.sendPush({ tokens: ['a'], body: 'b' })).rejects.toMatchObject({
      code: ERROR_CODES.TIMEOUT,
    });
  });

  it('sends once per idempotency key and validates input', async () => {
    const h = harness();
    const message = { tokens: ['a'], body: 'b' };
    await expect(h.notifier.sendPush(message, { idempotencyKey: 'k1' })).resolves.toMatchObject({
      sent: 1,
    });
    await expect(h.notifier.sendPush(message, { idempotencyKey: 'k1' })).resolves.toEqual({
      results: [],
      invalidTokens: [],
      sent: 0,
      failed: 0,
      duplicate: true,
    });
    await expect(h.notifier.sendEmail(email, { idempotencyKey: 'k1' })).resolves.toMatchObject({
      duplicate: false,
    });
    expect(h.push.sent).toHaveLength(1);
    await expect(h.notifier.sendPush({ tokens: [], body: 'b' })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
    await expect(h.notifier.sendPush(message, { idempotencyKey: '' })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
  });
});

describe('sendEmail', () => {
  it('sends, de-duplicates and wraps failures', async () => {
    const h = harness();
    await expect(h.notifier.sendEmail(email, { idempotencyKey: 'e1' })).resolves.toEqual({
      id: 'fake-1',
      status: 'SENT',
      duplicate: false,
    });
    await expect(h.notifier.sendEmail(email, { idempotencyKey: 'e1' })).resolves.toEqual({
      id: '',
      status: 'QUEUED',
      duplicate: true,
    });
    h.mail.failWith = new Error('smtp down');
    await expect(h.notifier.sendEmail(email)).rejects.toMatchObject({
      code: ERROR_CODES.EMAIL_FAILED,
      retryable: false,
    });
    expect(h.logs).toEqual([
      ['email call failed', { sender: 'fake', reason: ERROR_CODES.EMAIL_FAILED, retryable: false }],
    ]);
    h.mail.failWith = new SdkError('X_RATE', 'slow down', { retryable: true });
    await expect(h.notifier.sendEmail(email)).rejects.toMatchObject({ code: 'X_RATE' });
    expect(h.logs).toHaveLength(4);
    await expect(h.notifier.sendEmail({ ...email, to: ['nope'] })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
  });
});

describe('createNotifications', () => {
  it('builds fake and custom channels and refuses unconfigured ones', async () => {
    const fake = createNotifications({
      environment: 'dev',
      push: { provider: 'fake' },
      email: { provider: 'fake' },
    });
    expect(fake.pushSender).toBeInstanceOf(FakePushSender);
    expect(fake.emailSender).toBeInstanceOf(FakeEmailSender);
    await expect(fake.sendPush({ tokens: ['t'], body: 'b' })).resolves.toMatchObject({ sent: 1 });
    await fake.close();
    const closed: string[] = [];
    const sender: PushSender = {
      name: 'p',
      send: () => Promise.resolve([]),
      close: () => {
        closed.push('push');
        return Promise.resolve();
      },
    };
    const custom = createNotifications({
      environment: 'dev',
      push: { provider: 'custom' },
      pushSender: sender,
    });
    expect(custom.pushSender).toBe(sender);
    expect(custom.emailSender).toBeUndefined();
    await expect(custom.sendEmail(email)).rejects.toMatchObject({
      code: ERROR_CODES.CONFIG_INVALID,
    });
    await custom.close();
    expect(closed).toEqual(['push']);
    const customMail = createNotifications({
      environment: 'dev',
      email: { provider: 'custom' },
      emailSender: new FakeEmailSender(),
    });
    expect(customMail.emailSender).toBeInstanceOf(FakeEmailSender);
    const mailOnly = createNotifications({ environment: 'dev', email: { provider: 'fake' } });
    await expect(mailOnly.sendPush({ tokens: ['t'], body: 'b' })).rejects.toMatchObject({
      code: ERROR_CODES.CONFIG_INVALID,
    });
  });
});
