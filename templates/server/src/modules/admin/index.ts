import { Router } from 'express';
import { ADMIN_AUTH_ROUTES } from '../../constants/adminAuth';
import { AUDIT_ROUTES } from '../../constants/audit';
import { ITEM_ROUTES } from '../../constants/items';
import { ADMIN_SETTINGS_ROUTES } from '../../constants/settings';
import { UPLOAD_ROUTES } from '../../constants/uploads';
import type { AuditWriter } from '../../domain/audit';
import type { AdminAuthService } from '../../domain/auth/adminAuth.service';
import type { AdminLoginService } from '../../domain/auth/adminLogin.service';
import type { SettingsService } from '../../domain/settings';
import type { AuditLogsRepository } from '../../repositories/auditLogs.repository';
import { mount } from '../../routes/mount';
import { unavailable, unavailableGuard, type ApiServices } from '../services';
import { createAdminItemsRouterFor } from '../shared/items';
import { createOtpRouteLimiter } from '../shared/rateLimits';
import { createAdminUploadsRouter } from '../shared/uploads';
import { createAuditLogsRouter } from './auditLogs/auditLogs.routes';
import { createAdminAuthRouter } from './auth/auth.routes';
import { createAdminSettingsRouter } from './settings/settings.routes';

/** `/admin/v1`: every router except `/auth` sits behind `adminGuard`; every write is audited. */
export const createAdminRouter = (services: ApiServices = {}): Router => {
  const router = Router();
  const guard = services.adminGuard ?? unavailableGuard;
  mount(
    router,
    ADMIN_AUTH_ROUTES.base,
    createAdminAuthRouter({
      service: services.adminAuth?.service ?? unavailable<AdminAuthService>(),
      login: services.adminAuth?.login ?? unavailable<AdminLoginService>(),
      limiter: createOtpRouteLimiter(services, 'admin'),
    }),
  );
  mount(
    router,
    ADMIN_SETTINGS_ROUTES.base,
    createAdminSettingsRouter({
      settings: services.settings ?? unavailable<SettingsService>(),
      audit: services.audit ?? unavailable<AuditWriter>(),
      guard,
    }),
  );
  mount(
    router,
    AUDIT_ROUTES.base,
    createAuditLogsRouter({
      auditLogs: services.auditLogs ?? unavailable<Pick<AuditLogsRepository, 'findPage'>>(),
      guard,
    }),
  );
  mount(router, UPLOAD_ROUTES.base, createAdminUploadsRouter(services));
  mount(router, ITEM_ROUTES.base, createAdminItemsRouterFor(services));
  return router;
};
