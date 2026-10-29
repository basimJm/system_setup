import cors from 'cors';
import type { RequestHandler } from 'express';
import type { Store } from 'express-rate-limit';
import helmet from 'helmet';
import { HEALTH_PATHS } from '../constants/health';
import {
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
  CORS_EXPOSED_HEADERS,
  CORS_MAX_AGE_SEC,
  GLOBAL_RATE_LIMIT,
} from '../constants/security';
import type { Logger } from '../utils/logger';
import { createRateLimiter } from './rateLimit';

export interface SecurityOptions {
  /** Browser origins allowed to call the API (the admin panel). Native apps send no Origin. */
  readonly corsAllowedOrigins: readonly string[];
  readonly rateLimit?: { readonly windowMs: number; readonly max: number };
  /** Shared counter store (Redis) so the budget holds across instances. */
  readonly rateLimitStore?: Store;
  readonly logger?: Logger;
}

const EXEMPT_PATHS: ReadonlySet<string> = new Set(Object.values(HEALTH_PATHS));

/** Helmet headers, CORS limited to the configured origins, and the global rate limit. */
export const securityMiddlewares = ({
  corsAllowedOrigins,
  rateLimit = GLOBAL_RATE_LIMIT,
  rateLimitStore,
  logger,
}: SecurityOptions): RequestHandler[] => {
  const allowed = new Set(corsAllowedOrigins);
  return [
    helmet(),
    cors({
      origin: (origin, callback) => {
        callback(null, origin !== undefined && allowed.has(origin));
      },
      methods: [...CORS_ALLOWED_METHODS],
      allowedHeaders: [...CORS_ALLOWED_HEADERS],
      exposedHeaders: [...CORS_EXPOSED_HEADERS],
      maxAge: CORS_MAX_AGE_SEC,
    }),
    createRateLimiter({
      ...rateLimit,
      skip: (req) => EXEMPT_PATHS.has(req.path),
      failOpen: true,
      ...(rateLimitStore === undefined ? {} : { store: rateLimitStore }),
      ...(logger === undefined ? {} : { logger }),
    }),
  ];
};
