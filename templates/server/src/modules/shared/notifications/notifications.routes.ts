import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { NotificationRecipientType } from '../../../constants/enums';
import { NOTIFICATION_ROUTES } from '../../../constants/notifications';
import type { InboxFilter, InboxService } from '../../../domain/notifications/inbox.service';
import { validate } from '../../../middlewares/validate';
import { asyncHandler } from '../../../utils/async';
import { sendPaginated, sendSuccess } from '../../../utils/response/successResponse';
import { inboxQuerySchema, markReadBodySchema } from './notifications.validation';

export interface NotificationsRouterOptions {
  readonly service: InboxService;
  readonly recipientType: NotificationRecipientType;
  /** Middlewares that authenticate the app's account (customer token / merchant member). */
  readonly guard: readonly RequestHandler[];
  readonly limiter: RequestHandler;
}

export const createNotificationsRouter = ({
  service,
  recipientType,
  guard,
  limiter,
}: NotificationsRouterOptions): Router => {
  const router = Router();
  router.use(limiter, ...guard);
  const account = (req: Request): { recipientType: NotificationRecipientType; id: string } => ({
    recipientType,
    id: req.auth?.subjectId ?? '',
  });

  router.get(
    '/',
    validate({ query: inboxQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { page, pageSize, ...filter } = (
        req.validated as { query: { page: number; pageSize: number } & InboxFilter }
      ).query;
      const result = await service.list({
        account: account(req),
        language: req.language,
        filter,
        params: { page, pageSize },
      });
      sendPaginated(req, res, result.items, { page, pageSize }, result.meta.total);
    }),
  );
  router.get(
    NOTIFICATION_ROUTES.unreadCount,
    asyncHandler(async (req: Request, res: Response) => {
      sendSuccess(req, res, { data: { unread: await service.unreadCount(account(req)) } });
    }),
  );
  router.post(
    NOTIFICATION_ROUTES.read,
    validate({ body: markReadBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { ids } = (req.validated as { body: { ids: string[] } }).body;
      sendSuccess(req, res, { data: await service.markRead(account(req), ids) });
    }),
  );
  return router;
};
