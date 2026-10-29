import { Router } from 'express';
import { ITEM_ROUTES } from '../../constants/items';
import { MERCHANT_AUTH_ROUTES } from '../../constants/merchantAuth';
import { NOTIFICATION_ROUTES } from '../../constants/notifications';
import { OTP_ROUTES } from '../../constants/otp';
import { MERCHANT_ME_ROUTES, TEAM_ROUTES } from '../../constants/team';
import { UPLOAD_ROUTES } from '../../constants/uploads';
import type { MerchantAuthService } from '../../domain/auth/merchantAuth.service';
import type { TeamService } from '../../domain/team/team.service';
import type { MembersRepository } from '../../repositories/identity.repository';
import { mount } from '../../routes/mount';
import { unavailable, unavailableGuard, type ApiServices } from '../services';
import { createMerchantItemsRouter } from '../shared/items';
import { createMerchantNotificationsRouter } from '../shared/notifications';
import { createMerchantOtpRouter } from '../shared/otp';
import {
  createBrowseRouteLimiter,
  createOtpRouteLimiter,
  createWriteRouteLimiter,
} from '../shared/rateLimits';
import { createMerchantUploadsRouter } from '../shared/uploads';
import { createMerchantAuthRouter } from './auth/auth.routes';
import { createMerchantMeRouter } from './me/me.routes';
import { createTeamRouter } from './team/team.routes';

/** `/merchant/v1`: every route behind `requireAuth('merchant')` + `loadMember` except OTP/auth. */
export const createMerchantRouter = (services: ApiServices = {}): Router => {
  const router = Router();
  const guard = services.merchantAuth?.guard ?? [unavailableGuard];
  const members = services.members ?? unavailable<Pick<MembersRepository, 'findById'>>();
  mount(router, OTP_ROUTES.base, createMerchantOtpRouter(services));
  mount(
    router,
    MERCHANT_AUTH_ROUTES.base,
    createMerchantAuthRouter({
      service: services.merchantAuth?.service ?? unavailable<MerchantAuthService>(),
      limiter: createOtpRouteLimiter(services, 'merchant'),
    }),
  );
  mount(
    router,
    MERCHANT_ME_ROUTES.base,
    createMerchantMeRouter({
      members,
      guard,
      limiter: createBrowseRouteLimiter(services, 'merchant'),
    }),
  );
  mount(
    router,
    TEAM_ROUTES.base,
    createTeamRouter({
      service: services.team ?? unavailable<TeamService>(),
      members,
      guard,
      browseLimiter: createBrowseRouteLimiter(services, 'merchant'),
      writeLimiter: createWriteRouteLimiter(services, 'merchant'),
    }),
  );
  mount(router, UPLOAD_ROUTES.base, createMerchantUploadsRouter(services));
  mount(router, NOTIFICATION_ROUTES.base, createMerchantNotificationsRouter(services));
  mount(router, ITEM_ROUTES.base, createMerchantItemsRouter(services));
  return router;
};
