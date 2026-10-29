import express, { type Express, type Request, type Router } from 'express';
import { WEBHOOK_PREFIX } from './constants/providers';
import { DEFAULT_TRUST_PROXY_HOPS } from './constants/security';
import { JSON_BODY_LIMIT } from './constants/server';
import { errorHandler } from './middlewares/errorHandler';
import { language } from './middlewares/language';
import { sanitizeRequest } from './middlewares/sanitize';
import { securityMiddlewares, type SecurityOptions } from './middlewares/security';
import { notFound } from './middlewares/notFound';
import { requestId } from './middlewares/requestId';
import { buildOpenApiDocuments } from './docs';
import { createDocsRouter } from './docs/router';
import { createRootRouter, defaultWebhooks } from './routes';
import { createCustomerRouter } from './modules/customer';
import { createMerchantRouter } from './modules/merchant';
import { createAdminRouter } from './modules/admin';
import type { ApiServices } from './modules/services';
import { createHealthRouter } from './routes/health';
import type { ReadinessCheck } from './utils/health';
import type { Logger } from './utils/logger';

export interface AppDependencies {
  readonly logger: Logger;
  /** Defaults to the real namespace routers; tests inject their own. */
  readonly router?: Router;
  /** Dependency probes for `/ready` (MongoDB, Redis...), added as those connections exist. */
  readonly readinessChecks?: readonly ReadinessCheck[];
  /** CORS origins and rate limit; defaults allow no browser origin and use the global limit. */
  readonly security?: Partial<SecurityOptions>;
  /** Reverse proxies in front of the app, so `req.ip` is the real client address. */
  readonly trustProxyHops?: number;
  /** Serve Swagger UI at /docs. Off by default; the server turns it on outside production. */
  readonly docs?: boolean;
  /** Services for the feature routers; built by `server.ts` once Redis is up. */
  readonly services?: ApiServices;
}

/** Builds the Express app. Order matters: ids and language first, errors last. */
export const createApp = ({
  logger,
  router,
  readinessChecks,
  security,
  trustProxyHops = DEFAULT_TRUST_PROXY_HOPS,
  docs = false,
  services = {},
}: AppDependencies): Express => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxyHops);
  app.use(requestId(logger));
  app.use(language);
  app.use(securityMiddlewares({ corsAllowedOrigins: [], logger, ...security }));
  if (docs) app.use(createDocsRouter(buildOpenApiDocuments()));
  app.use(
    express.json({
      limit: JSON_BODY_LIMIT,
      verify: (req: Request, _res, buf) => {
        // Webhook signatures cover the exact bytes, which the parsed body no longer has.
        if (req.originalUrl.startsWith(WEBHOOK_PREFIX)) req.rawBody = buf.toString('utf8');
      },
    }),
  );
  app.use(sanitizeRequest);
  app.use(
    router ??
      createRootRouter(
        {
          customer: createCustomerRouter(services),
          merchant: createMerchantRouter(services),
          admin: createAdminRouter(services),
        },
        createHealthRouter(readinessChecks),
        [defaultWebhooks(services)],
      ),
  );
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
};
