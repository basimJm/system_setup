import type { Page, PageQuery } from '@/domain/shared/page';

/** One immutable record of something an admin did: what, to which entity, why, from where. */
export interface AuditLog {
  readonly id: string;
  readonly adminId: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly reason: string;
  readonly ip: string;
  readonly userAgent: string;
  readonly createdAt: string;
}
export interface AuditQuery extends PageQuery {
  adminId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
}
export interface AuditRepository {
  list(query: AuditQuery): Promise<Page<AuditLog>>;
}

/** `ITEM_SET_INACTIVE` -> `Item set inactive` when there is no translation for the action. */
export const humanizeAction = (action: string): string => {
  const words = action.toLowerCase().split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};
/** True when the record carries a change worth a diff. */
export const hasDiff = (log: Pick<AuditLog, 'before' | 'after'>): boolean =>
  log.before !== undefined || log.after !== undefined;
