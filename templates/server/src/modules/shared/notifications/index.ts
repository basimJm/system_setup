import type { Router } from 'express';
import type { InboxService } from '../../../domain/notifications/inbox.service';
import { unavailable, unavailableGuard, type ApiServices } from '../../services';
import { createBrowseRouteLimiter } from '../rateLimits';
import { createNotificationsRouter } from './notifications.routes';

export const createCustomerNotificationsRouter = (services: ApiServices): Router =>
  createNotificationsRouter({
    service: services.inbox ?? unavailable<InboxService>(),
    recipientType: 'CUSTOMER',
    guard: [services.customerAuth?.authenticate ?? unavailableGuard],
    limiter: createBrowseRouteLimiter(services, 'customer'),
  });

export const createMerchantNotificationsRouter = (services: ApiServices): Router =>
  createNotificationsRouter({
    service: services.inbox ?? unavailable<InboxService>(),
    recipientType: 'MEMBER',
    guard: services.merchantAuth?.guard ?? [unavailableGuard],
    limiter: createBrowseRouteLimiter(services, 'merchant'),
  });
