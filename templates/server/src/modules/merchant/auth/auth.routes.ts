import { Router, type RequestHandler } from 'express';
import { MERCHANT_AUTH_ROUTES } from '../../../constants/merchantAuth';
import type { MerchantAuthService } from '../../../domain/auth/merchantAuth.service';
import { validate } from '../../../middlewares/validate';
import { asyncHandler } from '../../../utils/async';
import { createMerchantAuthController } from './auth.controller';
import { checkPhoneSchema, loginSchema, refreshSchema, registerSchema } from './auth.validation';

export interface MerchantAuthRouterOptions {
  readonly service: MerchantAuthService;
  readonly limiter: RequestHandler;
}

export const createMerchantAuthRouter = ({
  service,
  limiter,
}: MerchantAuthRouterOptions): Router => {
  const router = Router();
  const controller = createMerchantAuthController(service);
  const routes = MERCHANT_AUTH_ROUTES;
  router.post(
    routes.checkPhone,
    limiter,
    validate({ body: checkPhoneSchema }),
    asyncHandler(controller.checkPhone),
  );
  router.post(
    routes.register,
    limiter,
    validate({ body: registerSchema }),
    asyncHandler(controller.register),
  );
  router.post(
    routes.login,
    limiter,
    validate({ body: loginSchema }),
    asyncHandler(controller.login),
  );
  router.post(
    routes.refresh,
    limiter,
    validate({ body: refreshSchema }),
    asyncHandler(controller.refresh),
  );
  router.post(
    routes.logout,
    limiter,
    validate({ body: refreshSchema }),
    asyncHandler(controller.logout),
  );
  return router;
};
