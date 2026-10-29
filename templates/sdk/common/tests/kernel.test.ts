import { z } from 'zod';
import {
  KERNEL_ERROR_CODES,
  SdkError,
  configError,
  delayFor,
  isHttps,
  isRetryable,
  isSdkError,
  noopLogger,
  parseOptions,
  plainOptions,
  prodIssues,
  realRetryDeps,
  redact,
  redactingLogger,
  resolveRetry,
  retrySchema,
  throwIfIssues,
  timeoutError,
  toSdkError,
  trimSlash,
  validationError,
  withRetry,
  withTimeout,
  type Logger,
} from '../src/kernel';

const policy = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 250, jitterRatio: 0.5 };
const instant = { sleep: () => Promise.resolve(), random: () => 0.5 };

describe('errors', () => {
  it('carries code, retryable, details and cause', () => {
    const cause = new Error('root');
    const error = new SdkError('X_CODE', 'boom', { retryable: true, cause, details: { a: 1 } });
    expect(error).toMatchObject({ name: 'SdkError', code: 'X_CODE', retryable: true });
    expect(error.details).toEqual({ a: 1 });
    expect(error.cause).toBe(cause);
    expect(new SdkError('Y', 'm')).toMatchObject({ retryable: false, details: {} });
    expect(isSdkError(error)).toBe(true);
    expect(isSdkError(new Error('x'))).toBe(false);
  });
  it('builds config and validation errors naming fields only', () => {
    expect(configError('bad', { fields: ['a'] })).toMatchObject({
      code: KERNEL_ERROR_CODES.CONFIG_INVALID,
      details: { fields: ['a'] },
    });
    expect(configError('bad').details).toEqual({});
    expect(validationError('v').code).toBe(KERNEL_ERROR_CODES.VALIDATION_FAILED);
  });
  it('wraps unknown throws and keeps SDK errors', () => {
    const own = validationError('v');
    expect(toSdkError(own)).toBe(own);
    expect(toSdkError(new Error('e'))).toMatchObject({
      code: KERNEL_ERROR_CODES.UNKNOWN,
      message: 'e',
    });
    expect(toSdkError('text', KERNEL_ERROR_CODES.VENDOR_ERROR)).toMatchObject({
      code: KERNEL_ERROR_CODES.VENDOR_ERROR,
      message: 'text',
      cause: 'text',
    });
  });
});

describe('logger', () => {
  it('redacts secret-looking keys at any depth and caps the depth', () => {
    const deep = { l1: { l2: { l3: { l4: { l5: { l6: { l7: 'x' } } } } } } };
    expect(redact({ token: 't', nested: [{ password: 'p', ok: 1 }], n: null })).toEqual({
      token: '[redacted]',
      nested: [{ password: '[redacted]', ok: 1 }],
      n: null,
    });
    expect(JSON.stringify(redact(deep))).toContain('[redacted]');
    expect(redact(3)).toBe(3);
  });
  it('wraps a logger and the noop logger swallows everything', () => {
    const calls: unknown[][] = [];
    const inner: Logger = {
      debug: (...a) => calls.push(['debug', ...a]),
      info: (...a) => calls.push(['info', ...a]),
      warn: (...a) => calls.push(['warn', ...a]),
      error: (...a) => calls.push(['error', ...a]),
    };
    const log = redactingLogger(inner);
    log.debug('d');
    log.info('i', { apiKey: 'k' });
    log.warn('w', { a: 1 });
    log.error('e', { secret: 's' });
    expect(calls).toEqual([
      ['debug', 'd', undefined],
      ['info', 'i', { apiKey: '[redacted]' }],
      ['warn', 'w', { a: 1 }],
      ['error', 'e', { secret: '[redacted]' }],
    ]);
    expect(() => {
      noopLogger.debug('x');
      noopLogger.info('x');
      noopLogger.warn('x');
      noopLogger.error('x');
    }).not.toThrow();
  });
});

describe('retry', () => {
  it('computes capped, jittered delays', () => {
    expect(delayFor(1, policy, () => 0.5)).toBe(100);
    expect(delayFor(2, policy, () => 1)).toBe(300);
    expect(delayFor(3, policy, () => 0)).toBe(125);
    expect(delayFor(1, { ...policy, jitterRatio: 1 }, () => 0)).toBe(0);
  });
  it('retries only retryable SDK errors up to maxAttempts', async () => {
    const retries: number[] = [];
    let calls = 0;
    const flaky = (): Promise<string> => {
      calls += 1;
      return calls < 3
        ? Promise.reject(new SdkError('R', 'again', { retryable: true }))
        : Promise.resolve('ok');
    };
    await expect(
      withRetry(flaky, policy, instant, (attempt) => retries.push(attempt)),
    ).resolves.toBe('ok');
    expect(retries).toEqual([1, 2]);
    await expect(
      withRetry(() => Promise.reject(new Error('plain')), policy, instant),
    ).rejects.toThrow('plain');
    const always = (): Promise<never> =>
      Promise.reject(new SdkError('R', 'x', { retryable: true }));
    await expect(withRetry(always, policy, instant)).rejects.toMatchObject({ code: 'R' });
    expect(isRetryable(new SdkError('R', 'x', { retryable: true }))).toBe(true);
    expect(isRetryable('nope')).toBe(false);
  });
  it('times out with a retryable TIMEOUT error or a custom one', async () => {
    await expect(withTimeout(Promise.resolve(1), 50)).resolves.toBe(1);
    const never = new Promise<never>(() => undefined);
    await expect(withTimeout(never, 1)).rejects.toMatchObject({
      code: KERNEL_ERROR_CODES.TIMEOUT,
      retryable: true,
      details: { timeoutMs: 1 },
    });
    await expect(withTimeout(never, 1, () => new Error('custom'))).rejects.toThrow('custom');
    expect(timeoutError(5).details).toEqual({ timeoutMs: 5 });
  });
  it('exposes real deps', async () => {
    await expect(realRetryDeps.sleep(1)).resolves.toBeUndefined();
    const r = realRetryDeps.random();
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(1);
  });
});

describe('config helpers', () => {
  it('resolves retry defaults and parses options naming fields only', () => {
    expect(resolveRetry(undefined)).toEqual({
      maxAttempts: 3,
      baseDelayMs: 200,
      maxDelayMs: 5000,
      jitterRatio: 0.2,
    });
    expect(resolveRetry({ maxAttempts: 1 }).maxAttempts).toBe(1);
    const schema = z.object({ retry: retrySchema.optional(), name: z.string() }).strict();
    expect(parseOptions(schema, { name: 'a' }, 'test')).toEqual({ name: 'a' });
    expect(() => parseOptions(schema, { name: 1, retry: { maxAttempts: 99 } }, 'test')).toThrow(
      expect.objectContaining({
        code: KERNEL_ERROR_CODES.CONFIG_INVALID,
        details: { fields: ['name', 'retry.maxAttempts'] },
      }) as Error,
    );
  });
  it('drops injected objects, checks https and trims slashes', () => {
    const logger = noopLogger;
    expect(plainOptions({ a: 1, logger }, ['logger'])).toEqual({ a: 1 });
    expect(isHttps('https://x.test')).toBe(true);
    expect(isHttps('http://x.test')).toBe(false);
    expect(trimSlash('http://x.test///')).toBe('http://x.test');
  });
  it('applies the production rules only in prod', () => {
    const base = { provider: 'fake', devOnlyProviders: ['fake', 'memory'] };
    expect(prodIssues({ ...base, environment: 'dev' })).toEqual([]);
    expect(
      prodIssues({
        ...base,
        environment: 'prod',
        urls: [
          { path: 'cdn.baseUrl', url: 'http://x.test' },
          { path: 'other', url: undefined },
          { path: 'ok', url: 'https://x.test' },
        ],
        secrets: [
          { path: 'apiKey', present: false },
          { path: 'id', present: true },
        ],
      }),
    ).toEqual([
      { path: 'provider', message: 'fake is refused in prod' },
      { path: 'cdn.baseUrl', message: 'prod requires https' },
      { path: 'apiKey', message: 'required in prod' },
    ]);
    expect(prodIssues({ environment: 'prod', provider: 'real', devOnlyProviders: [] })).toEqual([]);
  });
  it('throws a config error listing the issues', () => {
    expect(() => {
      throwIfIssues([], 'x');
    }).not.toThrow();
    expect(() => {
      throwIfIssues([{ path: 'p', message: 'm' }], 'kind');
    }).toThrow(
      expect.objectContaining({
        code: KERNEL_ERROR_CODES.CONFIG_INVALID,
        message: 'Invalid kind options: p (m)',
        details: { fields: ['p'] },
      }) as Error,
    );
  });
});
