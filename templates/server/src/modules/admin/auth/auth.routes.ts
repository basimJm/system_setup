import { Router, type RequestHandler } from 'express';
import { ADMIN_AUTH_ROUTES, ADMIN_LOGIN_ROUTES } from '../../../constants/adminAuth';
import type { AdminAuthService } from '../../../domain/auth/adminAuth.service';
import type { AdminLoginService } from '../../../domain/auth/adminLogin.service';
import { validate } from '../../../middlewares/validate';
import { asyncHandler } from '../../../utils/async';
import { createAdminAuthController } from './auth.controller';
import { loginSchema, refreshSchema, verifyOtpSchema } from './auth.validation';

export interface AdminAuthRouterOptions {
  readonly service: AdminAuthService;
  readonly login: AdminLoginService;
  /** Per-IP guard (fails closed). */
  readonly limiter: RequestHandler;
}

/**
 * Sign-in routes of the admin panel: password (`login`), then the emailed code (`verify-otp`),
 * which is the only way to get a session. A password alone never opens one.
 */
export const createAdminAuthRouter = ({
  service,
  login,
  limiter,
}: AdminAuthRouterOptions): Router => {
  const router = Router();
  const controller = createAdminAuthController(service, login);
  const routes = { ...ADMIN_AUTH_ROUTES, ...ADMIN_LOGIN_ROUTES };
  router.post(
    routes.login,
    limiter,
    validate({ body: loginSchema }),
    asyncHandler(controller.login),
  );
  router.post(
    routes.verifyOtp,
    limiter,
    validate({ body: verifyOtpSchema }),
    asyncHandler(controller.verifyOtp),
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
