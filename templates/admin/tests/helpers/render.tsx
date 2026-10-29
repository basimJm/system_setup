import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { Suspense, type ReactElement, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { buildRoutes } from '@/app/routes';
import { AppProviders } from '@/app/AppProviders';
import type { Container } from '@/app/container';
import { createSessionManager } from '@/app/sessionManager';
import { createSessionStore } from '@/app/session';
import { MockAuthRepository } from '@/data/auth/MockAuthRepository';
import type { AuthRepository } from '@/domain/auth/auth';
import { buildAppConfig } from '@/infrastructure/config/appConfig';
import { MIN_PASSWORD_LENGTH, MOCK_OTP_CODE } from '@/constants/auth';
import { STORAGE_KEYS } from '@/constants/storage';
import type { Language } from '@/constants/i18n';
import { createLogger } from '@/infrastructure/logger/logger';
import { ApiClient } from '@/data/api/ApiClient';
import { createMockRoutes } from '@/data/mock/fixtures';
import { createMockTransport } from '@/data/mock/mockTransport';
import { createScenarioStore } from '@/data/mock/scenarios';
import { RemoteAuditRepository } from '@/data/audit/RemoteAuditRepository';
import { RemoteItemsRepository } from '@/data/items/RemoteItemsRepository';
import { RemoteSettingsRepository } from '@/data/settings/RemoteSettingsRepository';
import { FakeRealtimeClient } from '@/data/realtime/FakeRealtimeClient';
import { HttpClient } from '@/infrastructure/http/HttpClient';

export function makeContainer(
  auth: AuthRepository = new MockAuthRepository(0),
  variant = 'dev-debug',
): Container {
  const session = createSessionStore();
  const logger = createLogger('silent');
  // Every API call goes through the real client stack into the contract-typed mock server (instant answers).
  const scenarios = createScenarioStore();
  const api = new ApiClient(
    new HttpClient({
      baseUrl: 'http://localhost',
      getToken: () => null,
      getLanguage: () => 'en',
      fetchFn: createMockTransport({
        routes: createMockRoutes(),
        scenarios,
        sleep: () => Promise.resolve(),
      }),
    }),
  );
  return {
    config: buildAppConfig({}, variant),
    logger,
    session,
    sessionManager: createSessionManager({ store: session, auth: () => auth, logger }),
    api,
    mock: { scenarios },
    realtime: new FakeRealtimeClient(),
    repositories: {
      auth,
      settings: new RemoteSettingsRepository(api),
      items: new RemoteItemsRepository(api),
      audit: new RemoteAuditRepository(api),
    },
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  };
}

/** Renders under the real providers. English by default so assertions read naturally; pass 'ar' for RTL checks. */
export function renderWithApp(
  ui: ReactElement,
  container: Container = makeContainer(),
  language: Language = 'en',
) {
  window.localStorage.setItem(STORAGE_KEYS.language, language);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders container={container}>{children}</AppProviders>
  );
  return { ...render(ui, { wrapper }), container };
}

/** Renders the real route table (guard, lazy pages, shell) at `path`. */
export function renderRoutes(
  path: string,
  options: { container?: Container; language?: Language; showDesignSystem?: boolean } = {},
) {
  const router = createMemoryRouter(buildRoutes(options.showDesignSystem ?? true), {
    initialEntries: [path],
  });
  const view = renderWithApp(
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>,
    options.container ?? makeContainer(),
    options.language ?? 'en',
  );
  return { router, ...view };
}

const TEST_EMAIL = 'admin@example.test';

/** Signs the mock admin in through the repository, like the login controller does. */
export async function signInContainer(container: Container): Promise<void> {
  const { auth } = container.repositories;
  await auth.login(TEST_EMAIL, 'p'.repeat(MIN_PASSWORD_LENGTH));
  container.session.set(await auth.verifyOtp(TEST_EMAIL, MOCK_OTP_CODE));
}
