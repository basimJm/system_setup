import { EXIT_CODE_FAILURE, EXIT_CODE_OK, SHUTDOWN_TIMEOUT_MS } from '../../constants/errorMapping';
import { withTimeout } from '../async/timeout';
import type { Logger } from '../logger';

export interface Closable {
  readonly name: string;
  readonly close: () => Promise<void>;
}

/** The slice of `process` we use, so tests can pass a fake. */
export interface ProcessLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  exit(code: number): never | void;
}

/**
 * Closes resources in the given order (HTTP server first, then Socket.IO/BullMQ, Redis, MongoDB).
 * A failing closer is logged and the rest still run. Safe to call more than once.
 */
export const createShutdown = (
  closables: readonly Closable[],
  logger: Logger,
  timeoutMs: number = SHUTDOWN_TIMEOUT_MS,
): (() => Promise<void>) => {
  let running: Promise<void> | undefined;
  return (): Promise<void> => {
    running ??= (async (): Promise<void> => {
      for (const { name, close } of closables) {
        try {
          await withTimeout(close(), timeoutMs);
          logger.info({ resource: name }, 'closed');
        } catch (err) {
          logger.error({ err, resource: name }, 'failed to close');
        }
      }
    })();
    return running;
  };
};

/**
 * Crashes are logged, resources closed, and the process exits non-zero so the host restarts it.
 * SIGTERM/SIGINT shut down gracefully and exit 0.
 */
export const registerProcessHandlers = (
  proc: ProcessLike,
  logger: Logger,
  shutdown: () => Promise<void>,
): void => {
  // A failing shutdown must still end in exit; otherwise a crashed process would linger.
  const exitAfterShutdown = (code: number): void => {
    shutdown()
      .catch((err: unknown) => {
        logger.error({ err }, 'shutdown failed');
      })
      .finally(() => {
        proc.exit(code);
      });
  };
  const fail = (event: string) => (reason: unknown) => {
    logger.fatal({ err: reason, event }, 'process crashed');
    exitAfterShutdown(EXIT_CODE_FAILURE);
  };
  const stop = (signal: string) => () => {
    logger.info({ signal }, 'shutting down');
    exitAfterShutdown(EXIT_CODE_OK);
  };
  proc.on('unhandledRejection', fail('unhandledRejection'));
  proc.on('uncaughtException', fail('uncaughtException'));
  proc.on('SIGTERM', stop('SIGTERM'));
  proc.on('SIGINT', stop('SIGINT'));
};
