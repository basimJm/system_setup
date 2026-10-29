import { Router, type Request, type Response } from 'express';
import { PAYMENT_WEBHOOK_ROUTE, WEBHOOK_SIGNATURE_HEADER } from '../../constants/providers';
import type { PaymentProvider, PaymentWebhookEvent } from '../../providers/payments';
import { asyncHandler } from '../../utils/async';
import { UnauthorizedError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response/successResponse';

export interface WebhooksRouterOptions {
  readonly payments: Pick<PaymentProvider, 'handleWebhook'>;
  /** Business reaction to a verified gateway event (orders, ledgers...). */
  readonly onPaymentEvent?: (event: PaymentWebhookEvent) => Promise<void>;
}

/**
 * Gateway callbacks. The provider authenticates the raw body (signature over the exact bytes) before
 * anything is trusted; an unverifiable call is 401 and changes nothing.
 */
export const createWebhooksRouter = ({
  payments,
  onPaymentEvent,
}: WebhooksRouterOptions): Router => {
  const router = Router();
  router.post(
    PAYMENT_WEBHOOK_ROUTE,
    asyncHandler(async (req: Request, res: Response) => {
      const signature = req.get(WEBHOOK_SIGNATURE_HEADER);
      if (signature === undefined || req.rawBody === undefined) throw new UnauthorizedError();
      const event = await payments.handleWebhook({ rawBody: req.rawBody, signature });
      if (event.kind !== 'IGNORED' && event.replayed !== true) await onPaymentEvent?.(event);
      sendSuccess(req, res, { data: { received: true } });
    }),
  );
  return router;
};
