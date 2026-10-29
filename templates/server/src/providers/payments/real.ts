import type { Logger } from '../../utils/logger';
import type { PaymentProvider } from './types';

export interface RealPaymentDeps {
  readonly logger: Logger;
  readonly isProduction: boolean;
}

/**
 * The production gateway (through the `__NPM_SCOPE__/payments` SDK). Implement `PaymentProvider`
 * here (sessions, verification, refunds, signed webhooks); until then `PAYMENT_PROVIDER=real` fails
 * at startup and `disabled` answers 503 on every gateway call (see src/providers/README.md).
 */
export const createRealPayments = (deps: RealPaymentDeps): PaymentProvider => {
  deps.logger.error({ provider: 'payments' }, 'real adapter not integrated');
  throw new Error(
    'payment adapter not integrated: implement createRealPayments in src/providers/payments/real.ts',
  );
};
