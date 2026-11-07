import { Fake__SDK_TITLE__Port } from '../src/adapters/fake';
import { ERROR_CODES, MAX_OPERATION_LENGTH, SdkError, create__SDK_TITLE__ } from '../src';
import { __SDK_TITLE__Service } from '../src/service';
import { resolveConfig } from '../src/config/options';

const request = { operation: 'ping', payload: {} };
const noSleep = { sleep: () => Promise.resolve(), random: () => 0 };

describe('create__SDK_TITLE__', () => {
  it('runs on the recording port in dev and returns the result', async () => {
    const client = create__SDK_TITLE__({ environment: 'dev', provider: 'fake' });
    await expect(client.execute(request)).resolves.toEqual({ id: 'fake-1', status: 'DONE' });
    expect(client.port).toBeInstanceOf(Fake__SDK_TITLE__Port);
    await expect(client.close()).resolves.toBeUndefined();
  });

  it('runs on the injected adapter and closes it', async () => {
    let closed = false;
    const port = {
      name: 'vendor',
      execute: () => Promise.resolve({ id: 'v-1', status: 'QUEUED' as const }),
      close: () => {
        closed = true;
        return Promise.resolve();
      },
    };
    const client = create__SDK_TITLE__({ environment: 'prod', provider: 'custom', port });
    await expect(client.execute(request)).resolves.toEqual({ id: 'v-1', status: 'QUEUED' });
    await client.close();
    expect(closed).toBe(true);
  });

  it('refuses an invalid request before the adapter is called', async () => {
    const client = create__SDK_TITLE__({ environment: 'dev', provider: 'fake' });
    for (const operation of [' ', 'x'.repeat(MAX_OPERATION_LENGTH + 1)])
      await expect(client.execute({ operation, payload: {} })).rejects.toMatchObject({
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    expect((client.port as Fake__SDK_TITLE__Port).executed).toHaveLength(0);
  });
});

describe('__SDK_TITLE__Service errors', () => {
  const build = (port: Fake__SDK_TITLE__Port, maxAttempts = 3): __SDK_TITLE__Service =>
    new __SDK_TITLE__Service(
      resolveConfig({ environment: 'dev', provider: 'fake', retry: { maxAttempts } }),
      port,
      noSleep,
    );

  it('wraps an unknown failure once, as not retryable', async () => {
    const port = new Fake__SDK_TITLE__Port();
    port.failWith = new Error('boom');
    await expect(build(port).execute(request)).rejects.toMatchObject({
      code: ERROR_CODES.OPERATION_FAILED,
      retryable: false,
    });
  });

  it('keeps an SdkError as it is and retries it only when retryable', async () => {
    const port = new Fake__SDK_TITLE__Port();
    let calls = 0;
    const flaky = {
      name: 'flaky',
      execute: () => {
        calls += 1;
        return calls < 3
          ? Promise.reject(new SdkError(ERROR_CODES.UNAVAILABLE, 'later', { retryable: true }))
          : port.execute(request);
      },
    };
    const service = new __SDK_TITLE__Service(
      resolveConfig({ environment: 'dev', provider: 'fake' }),
      flaky,
      noSleep,
    );
    await expect(service.execute(request)).resolves.toMatchObject({ status: 'DONE' });
    expect(calls).toBe(3);
  });

  it('gives up after the last attempt with the same error', async () => {
    const port = new Fake__SDK_TITLE__Port();
    port.failWith = new SdkError(ERROR_CODES.UNAVAILABLE, 'down', { retryable: true });
    await expect(build(port, 2).execute(request)).rejects.toMatchObject({
      code: ERROR_CODES.UNAVAILABLE,
    });
  });

  it('times out a hanging adapter', async () => {
    const hanging = { name: 'slow', execute: () => new Promise<never>(() => undefined) };
    const service = new __SDK_TITLE__Service(
      resolveConfig({ environment: 'dev', provider: 'fake', timeoutMs: 5, retry: { maxAttempts: 1 } }),
      hanging,
      noSleep,
    );
    await expect(service.execute(request)).rejects.toMatchObject({ code: ERROR_CODES.TIMEOUT });
  });
});
