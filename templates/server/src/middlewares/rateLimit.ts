import type { RequestHandler, Request } from 'express';
import { rateLimit, type Store } from 'express-rate-limit';
import { RATE_LIMIT_HEADER_DRAFT } from '../constants/security';
import { RateLimitError } from '../utils/errors';
import type { Logger } from '../utils/logger';

export interface RateLimiterOptions {
  readonly windowMs: number;
  readonly max: number;
  /** Defaults to in-memory (one instance only); production passes a `RedisRateLimitStore`. */
  readonly store?: Store;
  readonly skip?: (req: Request) => boolean;
  /**
   * What to do when the store is unreachable. `false` (default) rejects the request, which is right
   * for OTP, login and payments. `true` lets traffic through and logs, which is right for the global
   * limiter: a Redis blip must not take the whole API down.
   */
  readonly failOpen?: boolean;
  readonly logger?: Logger;
}

/** Per-IP limiter answering with the standard `RATE_LIMITED` (429) error envelope. */
export const createRateLimiter = ({
  windowMs,
  max,
  store,
  skip,
  failOpen = false,
  logger,
}: RateLimiterOptions): RequestHandler =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: RATE_LIMIT_HEADER_DRAFT,
    legacyHeaders: false,
    ...(store === undefined ? {} : { store }),
    ...(skip === undefined ? {} : { skip }),
    passOnStoreError: failOpen,
    ...(logger === undefined
      ? {}
      : {
          logger: {
            error: (err: unknown) => {
              logger.error({ err }, 'rate limit store error');
            },
            warn: (err: unknown) => {
              logger.warn({ err }, 'rate limit warning');
            },
          },
        }),
    handler: (_req, _res, next) => {
      next(new RateLimitError());
    },
  });
