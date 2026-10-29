import type { ApiClient } from '@/data/api/ApiClient';
import { defineEndpoint } from '@/data/api/endpoint';
import { defined } from '@/data/api/resource';
import * as dto from '@/data/contract/generated/dto';
import { OPERATIONS } from '@/data/contract/generated/operations';
import type { AuditRepository } from '@/domain/audit/audit';

const list = defineEndpoint(OPERATIONS.getAuditLogs, {
  data: dto.getAuditLogsDataSchema,
  query: dto.getAuditLogsQuerySchema,
});

export class RemoteAuditRepository implements AuditRepository {
  constructor(private readonly api: ApiClient) {}

  list: AuditRepository['list'] = (q) =>
    this.api.executePage(list, {
      query: defined({
        page: q.page,
        pageSize: q.pageSize,
        adminId: q.adminId,
        action: q.action,
        entityType: q.entityType,
        entityId: q.entityId,
      }),
    });
}
