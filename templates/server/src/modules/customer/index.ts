import { Router } from 'express';
import { CUSTOMER_AUTH_ROUTES } from '../../constants/customerAuth';
import { ITEM_ROUTES } from '../../constants/items';
import { NOTIFICATION_ROUTES } from '../../constants/notifications';
import { OTP_ROUTES } from '../../constants/otp';
import { CUSTOMER_PROFILE_ROUTES } from '../../constants/team';
import { UPLOAD_ROUTES } from '../../constants/uploads';
import type { CustomerAuthService } from '../../domain/auth/customerAuth.service';
import type { UploadVerifier } from '../../domain/uploads/uploads.service';
import type { CustomersRepository } from '../../repositories/identity.repository';
import { mount } from '../../routes/mount';
import { unavailable, unavailableGuard, type ApiServices } from '../services';
import { createCustomerItemsRouter } from '../shared/items';
import { createCustomerNotificationsRouter } from '../shared/notifications';
import { createCustomerOtpRouter } from '../shared/otp';
import { createBrowseRouteLimiter, createOtpRouteLimiter } from '../shared/rateLimits';
import { createCustomerUploadsRouter } from '../shared/uploads';
import { createCustomerAuthRouter } from './auth/auth.routes';
import { createCustomerProfileRouter } from './profile/profile.routes';

/** `/customer/v1`: every feature router is mounted here with `mount()` so the docs test sees it. */
export const createCustomerRouter = (services: ApiServices = {}): Router => {
  const router = Router();
  const authenticate = services.customerAuth?.authenticate ?? unavailableGuard;
  mount(router, OTP_ROUTES.base, createCustomerOtpRouter(services));
  mount(
    router,
    CUSTOMER_AUTH_ROUTES.base,
    createCustomerAuthRouter({
      service: services.customerAuth?.service ?? unavailable<CustomerAuthService>(),
      limiter: createOtpRouteLimiter(services, 'customer'),
      authenticate,
    }),
  );
  mount(
    router,
    CUSTOMER_PROFILE_ROUTES.base,
    createCustomerProfileRouter({
      customers:
        services.customers ?? unavailable<Pick<CustomersRepository, 'findById' | 'patch'>>(),
      uploads: services.uploads ?? unavailable<UploadVerifier>(),
      authenticate,
      limiter: createBrowseRouteLimiter(services, 'customer'),
    }),
  );
  mount(router, UPLOAD_ROUTES.base, createCustomerUploadsRouter(services));
  mount(router, NOTIFICATION_ROUTES.base, createCustomerNotificationsRouter(services));
  mount(router, ITEM_ROUTES.base, createCustomerItemsRouter(services));
  return router;
};
