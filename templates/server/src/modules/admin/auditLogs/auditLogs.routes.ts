import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { z } from 'zod';
import { validate } from '../../../middlewares/validate';
import type { AuditLogsRepository } from '../../../repositories/auditLogs.repository';
import { asyncHandler } from '../../../utils/async';
import { toObjectId } from '../../../utils/database/ids';
import { sendPaginated } from '../../../utils/response/successResponse';
import { auditLogsQuery } from './auditLogs.validation';

export interface AuditLogsRouterOptions {
  readonly auditLogs: Pick<AuditLogsRepository, 'findPage'>;
  readonly guard: RequestHandler;
}

/** Read-only view of the append-only audit log, newest first. */
export const createAuditLogsRouter = (options: AuditLogsRouterOptions): Router => {
  const router = Router();
  router.get(
    '/',
    options.guard,
    validate({ query: auditLogsQuery }),
    asyncHandler(async (req: Request, res: Response) => {
      const { page, pageSize, adminId, ...filter } = (
        req.validated as { query: z.infer<typeof auditLogsQuery> }
      ).query;
      const result = await options.auditLogs.findPage(
        {
          ...(adminId === undefined ? {} : { adminId: toObjectId(adminId) }),
          ...Object.fromEntries(Object.entries(filter).filter(([, v]) => v !== undefined)),
        },
        { page, pageSize },
      );
      sendPaginated(req, res, result.items, { page, pageSize }, result.meta.total);
    }),
  );
  return router;
};
