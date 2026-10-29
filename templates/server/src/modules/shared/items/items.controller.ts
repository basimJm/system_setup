import type { Request, Response } from 'express';
import { AUDIT_UNKNOWN_USER_AGENT } from '../../../constants/audit';
import type { z } from 'zod';
import type { AdminContext, ItemOwner, ItemsService } from '../../../domain/items/items.service';
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response/successResponse';
import type {
  adminItemListQuery,
  adminReasonSchema,
  createItemSchema,
  itemListQuery,
  updateItemSchema,
} from './items.validation';

type Handler = (req: Request, res: Response) => Promise<void>;
type Body<S extends z.ZodType> = z.infer<S>;
const idOf = (req: Request): string => (req.validated as { params: { id: string } }).params.id;

/** The owner routes (customer app, merchant app): the owner comes from the request's identity. */
export const createOwnerItemsController = (
  service: ItemsService,
  ownerOf: (req: Request) => ItemOwner,
): Record<'list' | 'get' | 'create' | 'update' | 'archive', Handler> => ({
  async list(req, res) {
    const { page, pageSize, ...filter } = (req.validated as { query: Body<typeof itemListQuery> })
      .query;
    const result = await service.list(ownerOf(req), filter, { page, pageSize });
    sendPaginated(req, res, result.items, { page, pageSize }, result.meta.total);
  },
  async get(req, res) {
    sendSuccess(req, res, { data: await service.get(ownerOf(req), idOf(req)) });
  },
  async create(req, res) {
    const body = (req.validated as { body: Body<typeof createItemSchema> }).body;
    sendCreated(req, res, await service.create(ownerOf(req), body));
  },
  async update(req, res) {
    const body = (req.validated as { body: Body<typeof updateItemSchema> }).body;
    sendSuccess(req, res, { data: await service.update(ownerOf(req), idOf(req), body) });
  },
  async archive(req, res) {
    sendSuccess(req, res, { data: await service.archive(ownerOf(req), idOf(req)) });
  },
});

/** Admin routes: every write takes a reason and lands in the audit log. */
export const createAdminItemsController = (
  service: ItemsService,
): Record<'list' | 'get' | 'archive' | 'restore', Handler> => {
  const contextOf = (req: Request): AdminContext => ({
    adminId: req.auth?.subjectId ?? '',
    reason: (req.validated as { body: Body<typeof adminReasonSchema> }).body.reason,
    ip: req.ip ?? '',
    userAgent: req.get('user-agent') ?? AUDIT_UNKNOWN_USER_AGENT,
  });
  return {
    async list(req, res) {
      const { page, pageSize, ...filter } = (
        req.validated as { query: Body<typeof adminItemListQuery> }
      ).query;
      const result = await service.adminList(filter, { page, pageSize });
      sendPaginated(req, res, result.items, { page, pageSize }, result.meta.total);
    },
    async get(req, res) {
      sendSuccess(req, res, { data: await service.adminGet(idOf(req)) });
    },
    async archive(req, res) {
      sendSuccess(req, res, { data: await service.adminArchive(idOf(req), contextOf(req)) });
    },
    async restore(req, res) {
      sendSuccess(req, res, { data: await service.adminRestore(idOf(req), contextOf(req)) });
    },
  };
};
