import { Schema, model, type Types } from 'mongoose';
import {
  AUDIT_ACTION_MAX_LENGTH,
  AUDIT_ACTION_PATTERN,
  AUDIT_ENTITY_ID_MAX_LENGTH,
  AUDIT_ENTITY_TYPE_MAX_LENGTH,
  AUDIT_IP_MAX_LENGTH,
  AUDIT_LOGS_COLLECTION,
  AUDIT_REASON_MAX_LENGTH,
  AUDIT_USER_AGENT_MAX_LENGTH,
} from '../constants/audit';
import { makeAppendOnly } from './appendOnly';

/** One admin write action (BUSINESS_DOMAIN.md §3.7). Append-only: never updated or deleted. */
export interface AuditLogRaw {
  adminId: Types.ObjectId;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason: string;
  ip: string;
  userAgent: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogRaw>(
  {
    adminId: { type: Schema.Types.ObjectId, required: true },
    action: {
      type: String,
      required: true,
      match: AUDIT_ACTION_PATTERN,
      maxlength: AUDIT_ACTION_MAX_LENGTH,
    },
    entityType: { type: String, required: true, maxlength: AUDIT_ENTITY_TYPE_MAX_LENGTH },
    entityId: { type: String, required: true, maxlength: AUDIT_ENTITY_ID_MAX_LENGTH },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    reason: { type: String, required: true, trim: true, maxlength: AUDIT_REASON_MAX_LENGTH },
    ip: { type: String, required: true, maxlength: AUDIT_IP_MAX_LENGTH },
    userAgent: { type: String, required: true, maxlength: AUDIT_USER_AGENT_MAX_LENGTH },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: AUDIT_LOGS_COLLECTION },
);
// "What did this admin do" and "what happened to this record", newest first; filter by action.
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
makeAppendOnly(auditLogSchema);

export const AuditLogModel = model<AuditLogRaw>('AuditLog', auditLogSchema);
