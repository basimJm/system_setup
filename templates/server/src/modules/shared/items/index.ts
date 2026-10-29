import type { Router } from 'express';
import type { ItemsService } from '../../../domain/items/items.service';
import { requirePermission } from '../../../middlewares/permission';
import { unavailable, unavailableGuard, type ApiServices } from '../../services';
import { createBrowseRouteLimiter, createWriteRouteLimiter } from '../rateLimits';
import { createAdminItemsRouter, createOwnerItemsRouter } from './items.routes';

const serviceOf = (services: ApiServices): ItemsService =>
  services.items ?? unavailable<ItemsService>();

export const createCustomerItemsRouter = (services: ApiServices): Router =>
  createOwnerItemsRouter({
    service: serviceOf(services),
    ownerOf: (req) => ({ type: 'CUSTOMER', id: req.auth?.subjectId ?? '' }),
    guard: [services.customerAuth?.authenticate ?? unavailableGuard],
    browseLimiter: createBrowseRouteLimiter(services, 'customer'),
    writeLimiter: createWriteRouteLimiter(services, 'customer'),
  });

/** Merchant items belong to the tenant; reads need ITEMS_VIEW, writes ITEMS_MANAGE. */
export const createMerchantItemsRouter = (services: ApiServices): Router =>
  createOwnerItemsRouter({
    service: serviceOf(services),
    ownerOf: (req) => ({ type: 'MERCHANT', id: req.member?.tenantId ?? '' }),
    guard: services.merchantAuth?.guard ?? [unavailableGuard],
    readGuard: [requirePermission(['ITEMS_VIEW', 'ITEMS_MANAGE'], 'any')],
    writeGuard: [requirePermission(['ITEMS_MANAGE'])],
    browseLimiter: createBrowseRouteLimiter(services, 'merchant'),
    writeLimiter: createWriteRouteLimiter(services, 'merchant'),
  });

export const createAdminItemsRouterFor = (services: ApiServices): Router =>
  createAdminItemsRouter({
    service: serviceOf(services),
    guard: services.adminGuard ?? unavailableGuard,
  });
