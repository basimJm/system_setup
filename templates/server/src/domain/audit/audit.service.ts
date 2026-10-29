import { z } from 'zod';
import {
  AUDIT_ACTION_MAX_LENGTH,
  AUDIT_ACTION_PATTERN,
  AUDIT_ENTITY_ID_MAX_LENGTH,
  AUDIT_ENTITY_TYPE_MAX_LENGTH,
  AUDIT_IP_MAX_LENGTH,
  AUDIT_REASON_MAX_LENGTH,
  AUDIT_USER_AGENT_MAX_LENGTH,
} from '../../constants/audit';
import { OBJECT_ID_PATTERN } from '../../constants/database';
import type { Entity } from '../../utils/database/plain';
import type { AuditLogRaw } from '../../models/auditLog.model';

const nonEmpty = (max: number): z.ZodString => z.string().trim().min(1).max(max);

/** What an admin write must tell the audit log (CLAUDE.md §5.12: always with a reason). */
export const auditEntrySchema = z.object({
  adminId: z.string().regex(OBJECT_ID_PATTERN),
  action: z.string().max(AUDIT_ACTION_MAX_LENGTH).regex(AUDIT_ACTION_PATTERN),
  entityType: nonEmpty(AUDIT_ENTITY_TYPE_MAX_LENGTH),
  entityId: nonEmpty(AUDIT_ENTITY_ID_MAX_LENGTH),
  /** State before / after the change; callers pass snapshots without secrets. */
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  reason: nonEmpty(AUDIT_REASON_MAX_LENGTH),
  ip: nonEmpty(AUDIT_IP_MAX_LENGTH),
  userAgent: nonEmpty(AUDIT_USER_AGENT_MAX_LENGTH),
});

export type AuditEntry = z.input<typeof auditEntrySchema>;
export type AuditRecord = Entity<AuditLogRaw>;

export interface AuditStore {
  append(data: Record<string, unknown>): Promise<AuditRecord>;
}

export interface AuditWriter {
  /**
   * Validates and stores one entry. Invalid input is a 400 and a storage failure is thrown too:
   * an admin write must not succeed without its audit record.
   */
  record(entry: AuditEntry): Promise<AuditRecord>;
}

export const createAuditWriter = (store: AuditStore): AuditWriter => ({
  async record(entry) {
    const { before, after, ...rest } = auditEntrySchema.parse(entry);
    return store.append({
      ...rest,
      ...(before === undefined ? {} : { before }),
      ...(after === undefined ? {} : { after }),
    });
  },
});
