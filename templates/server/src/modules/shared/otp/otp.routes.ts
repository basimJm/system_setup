import { Router, type RequestHandler } from 'express';
import { OTP_ROUTES } from '../../../constants/otp';
import type { PhoneOtpService } from '../../../domain/otp/phoneOtp.service';
import { validate } from '../../../middlewares/validate';
import { asyncHandler } from '../../../utils/async';
import { createOtpController } from './otp.controller';
import type { OtpSchemas } from './otp.validation';

export interface OtpRouterOptions {
  readonly service: PhoneOtpService;
  /** Customer and merchant accept different purposes. */
  readonly schemas: OtpSchemas;
  /** Per-IP guard (fails closed: a Redis outage answers 503, not "allowed"). */
  readonly limiter: RequestHandler;
}

/** Public routes (no token yet): send a code, then exchange the typed code for `otpToken`. */
export const createOtpRouter = ({ service, schemas, limiter }: OtpRouterOptions): Router => {
  const router = Router();
  const controller = createOtpController(service);
  router.post(
    OTP_ROUTES.request,
    limiter,
    validate({ body: schemas.request }),
    asyncHandler(controller.request),
  );
  router.post(
    OTP_ROUTES.verify,
    limiter,
    validate({ body: schemas.verify }),
    asyncHandler(controller.verify),
  );
  return router;
};
