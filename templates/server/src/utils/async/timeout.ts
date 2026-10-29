export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`timed out after ${String(timeoutMs)}ms`);
    this.name = 'TimeoutError';
  }
}

/** Rejects with `TimeoutError` when `task` does not settle in time. The timer never keeps the process alive. */
export const withTimeout = async <T>(task: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);
    timer.unref();
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};
