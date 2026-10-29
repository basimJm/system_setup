import { Router, type RequestHandler } from 'express';
import { CUSTOMER_AUTH_ROUTES } from '../../../constants/customerAuth';
import type { CustomerAuthService } from '../../../domain/auth/customerAuth.service';
import { validate } from '../../../middlewares/validate';
import { asyncHandler } from '../../../utils/async';
import { createCustomerAuthController } from './auth.controller';
import {
  changePhoneSchema,
  checkPhoneSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from './auth.validation';

export interface CustomerAuthRouterOptions {
  readonly service: CustomerAuthService;
  /** Per-IP guard for the public routes (fails closed). */
  readonly limiter: RequestHandler;
  /** `requireAuth('customer', secret)`: only change-phone needs a signed-in customer. */
  readonly authenticate: RequestHandler;
}

export const createCustomerAuthRouter = ({
  service,
  limiter,
  authenticate,
}: CustomerAuthRouterOptions): Router => {
  const router = Router();
  const controller = createCustomerAuthController(service);
  const routes = CUSTOMER_AUTH_ROUTES;
  router.post(
    routes.checkPhone,
    limiter,
    validate({ body: checkPhoneSchema }),
    asyncHandler(controller.checkPhone),
  );
  router.post(
    routes.login,
    limiter,
    validate({ body: loginSchema }),
    asyncHandler(controller.login),
  );
  router.post(
    routes.register,
    limiter,
    validate({ body: registerSchema }),
    asyncHandler(controller.register),
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
  router.post(
    routes.changePhone,
    limiter,
    authenticate,
    validate({ body: changePhoneSchema }),
    asyncHandler(controller.changePhone),
  );
  return router;
};
