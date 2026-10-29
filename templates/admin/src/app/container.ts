import { QueryClient } from '@tanstack/react-query';
import { QUERY_GC_TIME_MS, QUERY_MAX_RETRIES, QUERY_STALE_TIME_MS } from '@/constants/query';
import type { Language } from '@/constants/i18n';
import type { ScenarioStore } from '@/data/mock/scenarios';
import { ApiClient } from '@/data/api/ApiClient';
import { createRealtime } from '@/data/realtime/createRealtime';
import { startInvalidationBus } from '@/data/realtime/invalidationBus';
import type { RealtimeClient } from '@/domain/realtime/realtime';
import { createRepositories, type Repositories } from '@/data/repositories';
import type { AppConfig } from '@/infrastructure/config/appConfig';
import { AppError } from '@/infrastructure/errors/AppError';
import { normalizeError } from '@/infrastructure/errors/normalize';
import { HttpClient, type FetchFn } from '@/infrastructure/http/HttpClient';
import { createLogger, type Logger } from '@/infrastructure/logger/logger';
import { tabStorage } from '@/infrastructure/storage/tabStorage';
import { STORAGE_KEYS } from '@/constants/storage';
import { createSessionManager, type SessionManager } from './sessionManager';
import { createSessionStore, type SessionStore } from './session';

export interface Container {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly session: SessionStore;
  readonly sessionManager: SessionManager;
  readonly api: ApiClient;
  readonly realtime: RealtimeClient;
  /** Present only when the mock data source is active (dev builds). */
  readonly mock?: { scenarios: ScenarioStore };
  readonly repositories: Repositories;
  readonly queryClient: QueryClient;
}

const isRetryableQueryError = (failureCount: number, error: unknown): boolean =>
  failureCount < QUERY_MAX_RETRIES && error instanceof AppError && error.retryable;

/** Composition root: the only place concrete classes are wired together. */
export async function createContainer(
  config: AppConfig,
  getLanguage: () => Language,
): Promise<Container> {
  const logger = createLogger(config.logLevel);
  // A reload keeps the admin signed in (this tab only); the server idle limit still applies.
  const session = createSessionStore({ storage: tabStorage, key: STORAGE_KEYS.session });
  // The manager needs the repositories, which need the HTTP client, which needs the manager: tie the knot lazily.
  const manager: { current?: SessionManager } = {};
  let fetchFn: FetchFn | undefined;
  let mock: Container['mock'];
  if (__ALLOW_MOCK__ && config.dataSource === 'mock') {
    const [{ createMockTransport }, { createScenarioStore }, { createMockRoutes }] =
      await Promise.all([
        import('@/data/mock/mockTransport'),
        import('@/data/mock/scenarios'),
        import('@/data/mock/fixtures'),
      ]);
    const scenarios = createScenarioStore();
    fetchFn = createMockTransport({ routes: createMockRoutes(), scenarios });
    mock = { scenarios };
  }
  const http = new HttpClient({
    ...(fetchFn ? { fetchFn } : {}),
    baseUrl: config.apiBaseUrl || window.location.origin,
    getToken: () => session.get()?.accessToken ?? null,
    getLanguage,
    onUnauthorized: () => session.clear('expired'),
    ensureFresh: () => manager.current?.ensureFresh() ?? Promise.resolve(),
    refreshSession: () => manager.current?.refresh() ?? Promise.resolve(false),
    logger,
  });
  const api = new ApiClient(http);
  const repositories = await createRepositories(config, api);
  const sessionManager = createSessionManager({
    store: session,
    auth: () => repositories.auth,
    logger,
  });
  manager.current = sessionManager;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
        refetchOnWindowFocus: false,
        retry: (count, error) => isRetryableQueryError(count, normalizeError(error)),
      },
    },
  });
  const realtime = await createRealtime(config, logger);
  startInvalidationBus(realtime, queryClient);
  return {
    config,
    logger,
    session,
    sessionManager,
    api,
    realtime,
    ...(mock ? { mock } : {}),
    repositories,
    queryClient,
  };
}
