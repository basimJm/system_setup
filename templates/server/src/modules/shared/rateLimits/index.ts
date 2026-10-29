import type { RequestHandler } from 'express';
import {
  BROWSE_ROUTE_RATE_LIMIT,
  ROUTE_LIMIT_FAMILIES,
  WRITE_ROUTE_RATE_LIMIT,
  type RouteLimitFamily,
  type RouteLimitNamespace,
} from '../../../constants/security';
import { OTP_ROUTE_RATE_LIMIT } from '../../../constants/otp';
import { UPLOAD_ROUTE_RATE_LIMIT } from '../../../constants/uploads';
import { createRateLimiter } from '../../../middlewares/rateLimit';
import type { ApiServices } from '../../services';

export interface RouteLimit {
  readonly windowMs: number;
  readonly max: number;
}

/** Store scope of one limit family in one namespace, e.g. `customer:otp`. */
export const routeLimitScope = (namespace: RouteLimitNamespace, family: RouteLimitFamily): string =>
  `${namespace}:${family}`;

/**
 * Per-IP limiter of one route family. With a shared store every family counts on its own key, so
 * e.g. browsing cannot exhaust the OTP budget of the same IP.
 */
export const createRouteLimiter = (
  services: ApiServices,
  namespace: RouteLimitNamespace,
  family: RouteLimitFamily,
  limit: RouteLimit,
): RequestHandler => {
  const store = services.rateLimitStoreFor?.(routeLimitScope(namespace, family));
  return createRateLimiter({ ...limit, ...(store === undefined ? {} : { store }) });
};

/** OTP and sign-in routes (fail closed). */
export const createOtpRouteLimiter = (
  services: ApiServices,
  namespace: RouteLimitNamespace,
): RequestHandler =>
  createRouteLimiter(services, namespace, ROUTE_LIMIT_FAMILIES.otp, OTP_ROUTE_RATE_LIMIT);

/** Read-mostly routes (profile, inbox, lists). */
export const createBrowseRouteLimiter = (
  services: ApiServices,
  namespace: RouteLimitNamespace,
): RequestHandler =>
  createRouteLimiter(services, namespace, ROUTE_LIMIT_FAMILIES.browse, BROWSE_ROUTE_RATE_LIMIT);

/** Writes (create / update / archive). */
export const createWriteRouteLimiter = (
  services: ApiServices,
  namespace: RouteLimitNamespace,
): RequestHandler =>
  createRouteLimiter(services, namespace, ROUTE_LIMIT_FAMILIES.write, WRITE_ROUTE_RATE_LIMIT);

/** Presign / confirm uploads: kept on the strict per-minute budget, in its own counter. */
export const createUploadRouteLimiter = (
  services: ApiServices,
  namespace: RouteLimitNamespace,
): RequestHandler =>
  createRouteLimiter(services, namespace, ROUTE_LIMIT_FAMILIES.upload, UPLOAD_ROUTE_RATE_LIMIT);
