import { type ComponentType, type LazyExoticComponent } from 'react';
import { Navigate, useLocation, type RouteObject } from 'react-router-dom';
import { lazyPage } from './lazyPage';
import { DESIGN_SYSTEM_PATH, HOME_ROUTE, LOGIN_REDIRECT_PARAM, ROUTES } from '@/constants/routes';
import { NAV_PAGES } from '@/constants/nav';
import { RouteErrorPage } from '@/presentation/pages/RouteErrorPage';
import { AppShell } from '@/presentation/layout/AppShell';
import { useSession } from '@/presentation/controllers/useSession';
import { ModulePage } from '@/presentation/pages/ModulePage';

const LoginPage = lazyPage(() => import('@/presentation/pages/LoginPage'));
const NotFoundPage = lazyPage(() => import('@/presentation/pages/NotFoundPage'));
const ForbiddenPage = lazyPage(() => import('@/presentation/pages/ForbiddenPage'));
const ServerErrorPage = lazyPage(() => import('@/presentation/pages/ServerErrorPage'));

/** Feature pages that replace the placeholder of their nav entry (one line per finished module task). */
const FEATURE_PAGES: Readonly<Record<string, LazyExoticComponent<ComponentType>>> = {
  [ROUTES.items]: lazyPage(() => import('@/presentation/items/ItemsPage')),
  [ROUTES.settings]: lazyPage(() => import('@/presentation/settings/SettingsPage')),
  [ROUTES.auditLog]: lazyPage(() => import('@/presentation/audit/AuditPage')),
};
/** Record pages with a path parameter (opened from a list row). */
const DETAIL_PAGES: Readonly<Record<string, LazyExoticComponent<ComponentType>>> = {
  [`${ROUTES.items}/:id`]: lazyPage(() => import('@/presentation/items/ItemDetailsPage')),
};
const AboutPage = lazyPage(() => import('@/presentation/pages/AboutPage'));
/** Compile-time: `__SHOW_DESIGN_SYSTEM__` is false in prod builds, so the whole gallery chunk is dropped. */
const DesignSystemPage = __SHOW_DESIGN_SYSTEM__
  ? lazyPage(() => import('@/presentation/pages/DesignSystemPage'))
  : null;

function pageFor(path: string) {
  const Feature = FEATURE_PAGES[path];
  return Feature ? <Feature /> : <ModulePage path={path} />;
}

function RequireAuth() {
  const session = useSession();
  const location = useLocation();
  if (session) return <AppShell />;
  const next = encodeURIComponent(`${location.pathname}${location.search}`);
  return <Navigate to={`${ROUTES.login}?${LOGIN_REDIRECT_PARAM}=${next}`} replace />;
}

/** Route table. The design-system gallery exists only when `showDesignSystem` (dev builds). */
export function buildRoutes(showDesignSystem: boolean): RouteObject[] {
  const errorElement = <RouteErrorPage />;
  return [
    { path: ROUTES.login, element: <LoginPage />, errorElement },
    {
      element: <RequireAuth />,
      errorElement,
      children: [
        { index: true, element: <Navigate to={HOME_ROUTE} replace /> },
        ...NAV_PAGES.map((item) => ({ path: item.path, element: pageFor(item.path) })),
        ...Object.entries(DETAIL_PAGES).map(([path, Page]) => ({ path, element: <Page /> })),
        { path: ROUTES.forbidden, element: <ForbiddenPage /> },
        { path: ROUTES.serverError, element: <ServerErrorPage /> },
        { path: ROUTES.about, element: <AboutPage /> },
        ...(showDesignSystem && DesignSystemPage
          ? [{ path: DESIGN_SYSTEM_PATH, element: <DesignSystemPage /> }]
          : []),
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ];
}
