import type { Model } from 'mongoose';
import { AuditLogModel, type AuditLogRaw } from '../models/auditLog.model';
import { AppendOnlyRepository } from './appendOnly.repository';

export class AuditLogsRepository extends AppendOnlyRepository<AuditLogRaw> {
  constructor(model: Model<AuditLogRaw> = AuditLogModel) {
    super(model);
  }
}
