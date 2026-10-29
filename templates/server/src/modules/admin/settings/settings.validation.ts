import { z } from 'zod';
import { AUDIT_REASON_MAX_LENGTH, AUDIT_REASON_MIN_LENGTH } from '../../../constants/audit';
import { SETTING_KEYS } from '../../../domain/settings';

export const settingKeyParams = z.object({
  key: z.enum(SETTING_KEYS as [string, ...string[]]),
});
/** The value is checked by the setting's own schema in the service; the reason is for the audit log. */
export const updateSettingSchema = z.object({
  value: z.unknown(),
  reason: z.string().trim().min(AUDIT_REASON_MIN_LENGTH).max(AUDIT_REASON_MAX_LENGTH),
});
