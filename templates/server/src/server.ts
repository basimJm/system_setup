import { createServer, type Server } from 'node:http';
import type { Store } from 'express-rate-limit';
import type { Redis } from 'ioredis';
import { createApp } from './app';
import { loadConfig, type AppConfig } from './config';
import { REDIS_KEY_PREFIX } from './constants/redis';
import { createAuditWriter } from './domain/audit';
import { createAdminAuthService } from './domain/auth/adminAuth.service';
import { createAdminLoginService } from './domain/auth/adminLogin.service';
import { createCustomerAuthService } from './domain/auth/customerAuth.service';
import { createMerchantAuthService } from './domain/auth/merchantAuth.service';
import { createRefreshTokenService } from './domain/auth/refreshTokens.service';
import { createServerEvents } from './domain/events';
import { createItemsService } from './domain/items/items.service';
import { createInboxService } from './domain/notifications/inbox.service';
import { createNotificationService } from './domain/notifications/notifications.service';
import { createRecipientSource } from './domain/notifications/recipients';
import { createOtpGate } from './domain/otp/otpGate.service';
import { createPhoneOtpService } from './domain/otp/phoneOtp.service';
import { createSettingsService } from './domain/settings';
import { createTeamService } from './domain/team/team.service';
import { createUploadsService } from './domain/uploads/uploads.service';
import { createBullJobScheduler } from './jobs/bullmq';
import type { JobHandler, JobScheduler } from './jobs/jobs';
import { createPeriodicJobs } from './jobs/periodicJobs';
import { loadMember } from './middlewares/permission';
import { requireAuth } from './middlewares/auth';
import { ALL_MODELS } from './models';
import type { ApiServices } from './modules/services';
import { createProviders } from './providers';
import { AuditLogsRepository } from './repositories/auditLogs.repository';
import {
  AdminsRepository,
  CustomersRepository,
  MembersRepository,
  RefreshTokensRepository,
} from './repositories/identity.repository';
import { ItemsRepository } from './repositories/items.repository';
import { NotificationsRepository } from './repositories/notifications.repository';
import { ServerEventsRepository } from './repositories/serverEvents.repository';
import { SettingsRepository } from './repositories/settings.repository';
import { UploadsRepository } from './repositories/uploads.repository';
import { seedDevOnStart } from './seeds/devOnStart';
import { createAccessEvents } from './sockets/accessEvents';
import { createItemEvents } from './sockets/itemEvents';
import type { SocketRelay } from './sockets/relay';
import { createRoomsFor } from './sockets/rooms';
import {
  createSocketServer,
  type SocketHub,
  type SocketServerOptions,
} from './sockets/socketServer';
import {
  createMongoReadinessCheck,
  connectMongo,
  disconnectMongo,
} from './utils/database/connection';
import { ensureIndexes } from './utils/database/indexes';
import type { ReadinessCheck } from './utils/health';
import { createLogger, type Logger } from './utils/logger';
import {
  createShutdown,
  registerProcessHandlers,
  type Closable,
  type ProcessLike,
} from './utils/process/lifecycle';
import { connectRedis, createRedisReadinessCheck, disconnectRedis } from './utils/redis/client';
import { RedisRateLimitStore } from './utils/redis/rateLimitStore';

/** What the services need from the background-job system, and how they register their work. */
interface JobRuntime {
  readonly scheduler: JobScheduler;
  /** Processors by job name; services add theirs while they are built. */
  readonly handlers: Record<string, JobHandler>;
  /** Registers recurring schedules once the worker is up. */
  readonly schedules: (() => Promise<void>)[];
}

export interface RunningServer {
  readonly server: Server;
  readonly shutdown: () => Promise<void>;
  /** Present when started with `socket`: emit real-time events through it. */
  readonly sockets?: SocketHub;
}

const closeHttpServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
    server.closeIdleConnections();
  });

export interface StartOptions {
  /** Registers crash/signal handlers; only the real entry point passes it. */
  readonly proc?: ProcessLike;
  /** Resources opened before the server started, closed (in this order) after HTTP stops. */
  readonly closables?: readonly Closable[];
  /** Dependency probes for `/ready`. */
  readonly readinessChecks?: readonly ReadinessCheck[];
  /** Shared store for the global rate limit; without it each instance counts on its own. */
  readonly rateLimitStore?: Store;
  /** Services for the feature routers. */
  readonly services?: ApiServices;
  /** Starts Socket.IO (Redis adapter) on the HTTP server; needs the shared Redis connection. */
  readonly socket?: {
    readonly redis: Redis;
    readonly roomsFor?: SocketServerOptions['roomsFor'];
  };
}

/**
 * Starts listening and wires graceful shutdown: sockets and HTTP stop first, then the given
 * resources (jobs, providers, Redis, MongoDB).
 */
export const startServer = async (
  config: AppConfig,
  logger: Logger,
  {
    proc,
    closables = [],
    readinessChecks = [],
    rateLimitStore,
    services,
    socket,
  }: StartOptions = {},
): Promise<RunningServer> => {
  const app = createApp({
    logger,
    security: {
      corsAllowedOrigins: config.corsAllowedOrigins,
      ...(rateLimitStore === undefined ? {} : { rateLimitStore }),
    },
    trustProxyHops: config.trustProxyHops,
    docs: !config.isProduction,
    readinessChecks,
    ...(services === undefined ? {} : { services }),
  });
  // Plain http server: Express 5's `app.listen` passes listen errors to its callback as if started.
  const server = await new Promise<Server>((resolve, reject) => {
    const listening = createServer(app);
    listening.once('error', reject);
    listening.listen(config.port, () => {
      listening.off('error', reject);
      resolve(listening);
    });
  });
  const sockets =
    socket === undefined
      ? undefined
      : createSocketServer({
          httpServer: server,
          redis: socket.redis,
          accessSecret: config.auth.accessSecret,
          corsAllowedOrigins: config.corsAllowedOrigins,
          logger,
          ...(socket.roomsFor === undefined ? {} : { roomsFor: socket.roomsFor }),
        });
  const shutdown = createShutdown(
    [
      // Sockets first: open connections would keep the HTTP server from closing.
      ...(sockets === undefined ? [] : [{ name: 'sockets', close: () => sockets.close() }]),
      { name: 'http', close: () => closeHttpServer(server) },
      ...closables,
    ],
    logger,
  );
  if (proc) registerProcessHandlers(proc, logger, shutdown);
  logger.info({ port: config.port, env: config.env }, 'server listening');
  return { server, shutdown, ...(sockets === undefined ? {} : { sockets }) };
};

/** Services the feature routers need; built once, after MongoDB and Redis are connected. */
const buildServices = (
  config: AppConfig,
  logger: Logger,
  redis: Redis,
  relay: SocketRelay,
  jobs: JobRuntime,
): ApiServices => {
  const settings = createSettingsService({ store: new SettingsRepository(), redis, logger });
  const serverEventsRepository = new ServerEventsRepository();
  const serverEvents = createServerEvents({ store: serverEventsRepository, logger });
  const providers = createProviders(config.providers, config.isProduction, {
    redis,
    logger,
    config,
    serverEvents: { events: serverEvents, counter: serverEventsRepository },
  });
  const customers = new CustomersRepository();
  const members = new MembersRepository();
  const admins = new AdminsRepository();
  const otpGate = createOtpGate({ redis, settings });
  const refreshTokens = createRefreshTokenService({
    repository: new RefreshTokensRepository(),
    logger,
  });
  const access = createAccessEvents({ relay, logger });
  const itemEvents = createItemEvents({ relay, logger });
  const audit = createAuditWriter(new AuditLogsRepository());
  const notificationsRepository = new NotificationsRepository();
  const notifications = createNotificationService({
    notifications: notificationsRepository,
    recipients: createRecipientSource({ customers, members }),
    notifier: providers.notifier,
    access,
    logger,
  });
  const uploads = createUploadsService({
    uploads: new UploadsRepository(),
    storage: providers.storage,
    settings,
  });
  const phoneServices = {
    otp: providers.otp,
    otpGate,
    refreshTokens,
    settings,
    accessSecret: config.auth.accessSecret,
  };
  const customerAuth = createCustomerAuthService({
    ...phoneServices,
    customers,
    onRegistered: (customer) => {
      void notifications.notify({
        recipient: { type: 'CUSTOMER', id: customer.id },
        event: 'account.welcome',
        params: { name: customer.name },
        dedupeKey: `account.welcome:${customer.id}`,
      });
    },
  });
  const merchantAuth = createMerchantAuthService({ ...phoneServices, members });
  const adminAuth = createAdminAuthService({
    admins,
    refreshTokens,
    settings,
    logger,
    accessSecret: config.auth.accessSecret,
  });
  const adminLogin = createAdminLoginService({
    auth: adminAuth,
    admins,
    redis,
    notifier: providers.notifier,
    settings,
    logger,
    secret: config.auth.accessSecret,
  });
  const periodic = createPeriodicJobs({
    scheduler: jobs.scheduler,
    settings,
    notifications: notificationsRepository,
    overviewTick: () => {
      itemEvents.overviewTick();
    },
    logger,
  });
  Object.assign(jobs.handlers, periodic.handlers);
  jobs.schedules.push(() => periodic.register());

  return {
    phoneOtp: createPhoneOtpService({ gate: otpGate, otp: providers.otp, settings }),
    customerAuth: {
      service: customerAuth,
      authenticate: requireAuth('customer', config.auth.accessSecret),
    },
    customers,
    merchantAuth: {
      service: merchantAuth,
      guard: [requireAuth('merchant', config.auth.accessSecret), loadMember(members)],
    },
    members,
    team: createTeamService({ members, refreshTokens, access }),
    adminAuth: { service: adminAuth, login: adminLogin },
    adminGuard: requireAuth('admin', config.auth.accessSecret),
    audit,
    auditLogs: new AuditLogsRepository(),
    settings,
    items: createItemsService({
      items: new ItemsRepository(),
      settings,
      uploads,
      publicUrl: (key) => providers.storage.getPublicUrl(key),
      audit,
      notifications,
      events: {
        created: (item) => {
          itemEvents.created(item);
        },
        updated: (item) => {
          itemEvents.updated(item);
        },
      },
    }),
    inbox: createInboxService({ notifications: notificationsRepository, settings, access }),
    uploads,
    payments: providers.payments,
    rateLimitStoreFor: (scope) =>
      new RedisRateLimitStore(redis, `${REDIS_KEY_PREFIX.httpRateLimit}:${scope}`),
    providersClose: providers.close,
  };
};

const main = async (): Promise<void> => {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });
  const mongo = await connectMongo(config, logger);
  let redis: Redis | undefined;
  try {
    await ensureIndexes(ALL_MODELS, logger);
    redis = await connectRedis(config, logger);
    const connected = redis;
    const relay: SocketRelay = {};
    const scheduler = createBullJobScheduler({ redis: connected, logger });
    const jobs: JobRuntime = { scheduler, handlers: {}, schedules: [] };
    const services = buildServices(config, logger, connected, relay, jobs);
    const running = await startServer(config, logger, {
      proc: process,
      closables: [
        { name: 'jobs', close: () => scheduler.close() },
        { name: 'providers', close: () => services.providersClose?.() ?? Promise.resolve() },
        { name: 'redis', close: () => disconnectRedis(connected) },
        { name: 'mongodb', close: disconnectMongo },
      ],
      readinessChecks: [createMongoReadinessCheck(mongo), createRedisReadinessCheck(connected)],
      rateLimitStore: new RedisRateLimitStore(
        connected,
        `${REDIS_KEY_PREFIX.httpRateLimit}:global`,
      ),
      services,
      socket: { redis: connected, roomsFor: createRoomsFor(new MembersRepository()) },
    });
    // Services emit through the relay as soon as the hub exists.
    if (running.sockets !== undefined) relay.current = running.sockets;
    // The worker starts after the API is up.
    await scheduler.work(jobs.handlers);
    for (const schedule of jobs.schedules) {
      try {
        await schedule();
      } catch (error) {
        logger.error({ err: error }, 'recurring jobs could not be registered');
      }
    }
    // Development data: in the background, after the API is up; never throws.
    if (config.devSeed.onStart) void seedDevOnStart({ config, logger, env: process.env });
  } catch (error) {
    if (redis) await disconnectRedis(redis);
    await disconnectMongo();
    throw error;
  }
};

if (require.main === module) {
  main().catch((error: unknown) => {
    // Logger may not exist yet (invalid config), so write the reason to stderr and fail.
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
