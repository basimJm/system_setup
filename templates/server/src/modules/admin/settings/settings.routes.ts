import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { z } from 'zod';
import { AUDIT_UNKNOWN_USER_AGENT } from '../../../constants/audit';
import { ADMIN_SETTINGS_ROUTES, SETTINGS_AUDIT } from '../../../constants/settings';
import type { AuditWriter } from '../../../domain/audit';
import {
  SETTING_DEFINITIONS,
  type SettingKey,
  type SettingsService,
} from '../../../domain/settings';
import { validate } from '../../../middlewares/validate';
import { asyncHandler } from '../../../utils/async';
import { sendSuccess } from '../../../utils/response/successResponse';
import { settingKeyParams, updateSettingSchema } from './settings.validation';

export interface AdminSettingsRouterOptions {
  readonly settings: SettingsService;
  readonly audit: Pick<AuditWriter, 'record'>;
  readonly guard: RequestHandler;
}

/** Settings registry: every value with its default; a change needs a reason and is audited. */
export const createAdminSettingsRouter = (options: AdminSettingsRouterOptions): Router => {
  const router = Router();
  router.use(options.guard);
  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const snapshot = await options.settings.snapshot();
      const data = (Object.keys(SETTING_DEFINITIONS) as SettingKey[]).map((key) => ({
        key,
        value: snapshot[key],
        default: SETTING_DEFINITIONS[key].default,
      }));
      sendSuccess(req, res, { data });
    }),
  );
  router.put(
    ADMIN_SETTINGS_ROUTES.byKey,
    validate({ params: settingKeyParams, body: updateSettingSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = req.validated as {
        params: z.infer<typeof settingKeyParams>;
        body: z.infer<typeof updateSettingSchema>;
      };
      const key = params.key as SettingKey;
      const before = await options.settings.get(key);
      const value = await options.settings.set(key, body.value);
      await options.audit.record({
        adminId: req.auth?.subjectId ?? '',
        action: SETTINGS_AUDIT.action,
        entityType: SETTINGS_AUDIT.entityType,
        entityId: key,
        before: { value: before },
        after: { value },
        reason: body.reason,
        ip: req.ip ?? '',
        userAgent: req.get('user-agent') ?? AUDIT_UNKNOWN_USER_AGENT,
      });
      sendSuccess(req, res, { data: { key, value } });
    }),
  );
  return router;
};
