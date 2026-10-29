import { Router, type Request, type RequestHandler } from 'express';
import { ITEM_ROUTES } from '../../../constants/items';
import type { ItemOwner, ItemsService } from '../../../domain/items/items.service';
import { validate } from '../../../middlewares/validate';
import { asyncHandler } from '../../../utils/async';
import { createAdminItemsController, createOwnerItemsController } from './items.controller';
import {
  adminItemListQuery,
  adminReasonSchema,
  createItemSchema,
  itemIdParams,
  itemListQuery,
  updateItemSchema,
} from './items.validation';

export interface OwnerItemsRouterOptions {
  readonly service: ItemsService;
  readonly ownerOf: (req: Request) => ItemOwner;
  /** Authentication (customer token, or merchant token + member load). */
  readonly guard: readonly RequestHandler[];
  /** Extra guards on writes (merchant: `ITEMS_MANAGE`); reads need `readGuard`. */
  readonly readGuard?: readonly RequestHandler[];
  readonly writeGuard?: readonly RequestHandler[];
  readonly browseLimiter: RequestHandler;
  readonly writeLimiter: RequestHandler;
}

/** The owner's CRUD: route → validate → controller → service. */
export const createOwnerItemsRouter = (options: OwnerItemsRouterOptions): Router => {
  const { service, ownerOf, guard, readGuard = [], writeGuard = [] } = options;
  const router = Router();
  const controller = createOwnerItemsController(service, ownerOf);
  router.get(
    '/',
    options.browseLimiter,
    ...guard,
    ...readGuard,
    validate({ query: itemListQuery }),
    asyncHandler(controller.list),
  );
  router.post(
    '/',
    options.writeLimiter,
    ...guard,
    ...writeGuard,
    validate({ body: createItemSchema }),
    asyncHandler(controller.create),
  );
  router.get(
    ITEM_ROUTES.byId,
    options.browseLimiter,
    ...guard,
    ...readGuard,
    validate({ params: itemIdParams }),
    asyncHandler(controller.get),
  );
  router.patch(
    ITEM_ROUTES.byId,
    options.writeLimiter,
    ...guard,
    ...writeGuard,
    validate({ params: itemIdParams, body: updateItemSchema }),
    asyncHandler(controller.update),
  );
  router.post(
    ITEM_ROUTES.archive,
    options.writeLimiter,
    ...guard,
    ...writeGuard,
    validate({ params: itemIdParams }),
    asyncHandler(controller.archive),
  );
  return router;
};

export interface AdminItemsRouterOptions {
  readonly service: ItemsService;
  readonly guard: RequestHandler;
}

export const createAdminItemsRouter = ({ service, guard }: AdminItemsRouterOptions): Router => {
  const router = Router();
  router.use(guard);
  const controller = createAdminItemsController(service);
  router.get('/', validate({ query: adminItemListQuery }), asyncHandler(controller.list));
  router.get(ITEM_ROUTES.byId, validate({ params: itemIdParams }), asyncHandler(controller.get));
  router.post(
    ITEM_ROUTES.archive,
    validate({ params: itemIdParams, body: adminReasonSchema }),
    asyncHandler(controller.archive),
  );
  router.post(
    ITEM_ROUTES.restore,
    validate({ params: itemIdParams, body: adminReasonSchema }),
    asyncHandler(controller.restore),
  );
  return router;
};
