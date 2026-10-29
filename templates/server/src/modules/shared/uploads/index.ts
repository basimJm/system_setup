import type { Request, Router } from 'express';
import type { UploadActor, UploadsService } from '../../../domain/uploads/uploads.service';
import { unavailable, unavailableGuard, type ApiServices } from '../../services';
import { createUploadRouteLimiter } from '../rateLimits';
import { createUploadsRouter } from './uploads.routes';

const subject = (req: Request): string => req.auth?.subjectId ?? '';

export const createCustomerUploadsRouter = (services: ApiServices): Router =>
  createUploadsRouter({
    service: services.uploads ?? unavailable<UploadsService>(),
    guard: [services.customerAuth?.authenticate ?? unavailableGuard],
    actorOf: (req): UploadActor => ({
      scope: 'customer',
      ownerType: 'CUSTOMER',
      ownerId: subject(req),
    }),
    limiter: createUploadRouteLimiter(services, 'customer'),
  });

export const createMerchantUploadsRouter = (services: ApiServices): Router =>
  createUploadsRouter({
    service: services.uploads ?? unavailable<UploadsService>(),
    guard: services.merchantAuth?.guard ?? [unavailableGuard],
    actorOf: (req): UploadActor => ({
      scope: 'merchant',
      ownerType: 'MEMBER',
      ownerId: req.member?.id ?? '',
      tenantId: req.member?.tenantId,
      role: req.member?.role,
      permissions: req.member?.permissions,
    }),
    limiter: createUploadRouteLimiter(services, 'merchant'),
  });

export const createAdminUploadsRouter = (services: ApiServices): Router =>
  createUploadsRouter({
    service: services.uploads ?? unavailable<UploadsService>(),
    guard: [services.adminGuard ?? unavailableGuard],
    actorOf: (req): UploadActor => ({ scope: 'admin', ownerType: 'ADMIN', ownerId: subject(req) }),
    limiter: createUploadRouteLimiter(services, 'admin'),
  });
