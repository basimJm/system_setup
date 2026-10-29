import { EventEmitter } from 'node:events';
import { EXIT_CODE_FAILURE, EXIT_CODE_OK } from '../src/constants/errorMapping';
import { createLogger } from '../src/utils/logger';
import { createShutdown, registerProcessHandlers } from '../src/utils/process/lifecycle';

const logger = createLogger({ level: 'silent' });
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('createShutdown', () => {
  it('closes resources in order', async () => {
    const order: string[] = [];
    const shutdown = createShutdown(
      [
        {
          name: 'http',
          close: () => {
            order.push('http');
            return Promise.resolve();
          },
        },
        {
          name: 'redis',
          close: () => {
            order.push('redis');
            return Promise.resolve();
          },
        },
        {
          name: 'mongo',
          close: () => {
            order.push('mongo');
            return Promise.resolve();
          },
        },
      ],
      logger,
    );
    await shutdown();
    expect(order).toEqual(['http', 'redis', 'mongo']);
  });

  it('keeps closing after a failure', async () => {
    const closed = jest.fn().mockResolvedValue(undefined);
    const shutdown = createShutdown(
      [
        { name: 'bad', close: () => Promise.reject(new Error('nope')) },
        { name: 'good', close: closed },
      ],
      logger,
    );
    await shutdown();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('gives up on a closer that hangs', async () => {
    const after = jest.fn().mockResolvedValue(undefined);
    const shutdown = createShutdown(
      [
        { name: 'hang', close: () => new Promise<void>(() => undefined) },
        { name: 'after', close: after },
      ],
      logger,
      20,
    );
    await shutdown();
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('runs only once when called repeatedly', async () => {
    const close = jest.fn().mockResolvedValue(undefined);
    const shutdown = createShutdown([{ name: 'x', close }], logger);
    await Promise.all([shutdown(), shutdown()]);
    await shutdown();
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('registerProcessHandlers', () => {
  const setup = (): { proc: EventEmitter & { exit: jest.Mock }; shutdown: jest.Mock } => {
    const proc = Object.assign(new EventEmitter(), { exit: jest.fn() });
    const shutdown = jest.fn().mockResolvedValue(undefined);
    registerProcessHandlers(proc, logger, shutdown);
    return { proc, shutdown };
  };

  it.each(['unhandledRejection', 'uncaughtException'])(
    'closes resources and exits non-zero on %s',
    async (event) => {
      const { proc, shutdown } = setup();
      proc.emit(event, new Error('crash'));
      await flush();
      expect(shutdown).toHaveBeenCalledTimes(1);
      expect(proc.exit).toHaveBeenCalledWith(EXIT_CODE_FAILURE);
    },
  );

  it.each(['SIGTERM', 'SIGINT'])('shuts down gracefully and exits 0 on %s', async (signal) => {
    const { proc, shutdown } = setup();
    proc.emit(signal);
    await flush();
    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(proc.exit).toHaveBeenCalledWith(EXIT_CODE_OK);
  });

  it('still exits when shutdown itself fails', async () => {
    const proc = Object.assign(new EventEmitter(), { exit: jest.fn() });
    registerProcessHandlers(proc, logger, () => Promise.reject(new Error('close failed')));
    proc.emit('SIGTERM');
    await flush();
    expect(proc.exit).toHaveBeenCalledWith(EXIT_CODE_OK);
  });
});
