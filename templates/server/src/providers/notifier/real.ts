import type { Logger } from '../../utils/logger';
import type { Notifier } from './types';

export interface RealNotifierDeps {
  readonly logger: Logger;
  readonly isProduction: boolean;
}

/** A notifier that owns connections (SMTP pool, Firebase app) and releases them on shutdown. */
export interface ClosableNotifier extends Notifier {
  close(): Promise<void>;
}

/**
 * The production notifier (FCM push + SMTP email through the `__NPM_SCOPE__/notifications` SDK, or
 * any vendor). Implement `ClosableNotifier` here; until then `NOTIFIER_PROVIDER=real` fails at
 * startup (see src/providers/README.md).
 */
export const createRealNotifier = (deps: RealNotifierDeps): ClosableNotifier => {
  deps.logger.error({ provider: 'notifier' }, 'real adapter not integrated');
  throw new Error(
    'notifier adapter not integrated: implement createRealNotifier in src/providers/notifier/real.ts',
  );
};
