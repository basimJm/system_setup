import { AdminModel } from './admin.model';
import { AuditLogModel } from './auditLog.model';
import { CustomerModel } from './customer.model';
import { ItemModel } from './item.model';
import { MemberModel } from './member.model';
import { NotificationModel } from './notification.model';
import { RefreshTokenModel } from './refreshToken.model';
import { ServerEventModel } from './serverEvent.model';
import { SettingModel } from './setting.model';
import { UploadModel } from './upload.model';

/**
 * Every Mongoose model of the server. Start-up creates their indexes, so a new model must be
 * added here; `tests/indexes.test.ts` fails when one is missing.
 */
export const ALL_MODELS = [
  SettingModel,
  AuditLogModel,
  ServerEventModel,
  CustomerModel,
  MemberModel,
  RefreshTokenModel,
  AdminModel,
  UploadModel,
  NotificationModel,
  ItemModel,
] as const;
