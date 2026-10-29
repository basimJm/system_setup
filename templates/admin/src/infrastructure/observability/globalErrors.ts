import type { Logger } from '../logger/logger';
import { normalizeError } from '../errors/normalize';

/** Last-resort handlers: nothing may fail silently. Returns the unsubscribe function. */
export function registerGlobalErrorHandlers(target: Window, logger: Logger): () => void {
  const onError = (event: ErrorEvent) => {
    logger.error('window.error', {
      message: event.message,
      source: event.filename,
      line: event.lineno,
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const error = normalizeError(event.reason);
    logger.error('unhandled.rejection', {
      kind: error.kind,
      message: error.message,
      traceId: error.traceId,
    });
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
