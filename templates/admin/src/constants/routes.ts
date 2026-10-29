export const ROUTES = {
  root: '/',
  login: '/login',
  items: '/items',
  settings: '/settings',
  auditLog: '/audit-log',
  about: '/about',
  forbidden: '/forbidden',
  serverError: '/error',
} as const;
export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/** The first screen after sign-in (and the target of `/`). */
export const HOME_ROUTE: RoutePath = ROUTES.items;

export const LOGIN_REDIRECT_PARAM = 'next';

/** Dev-only gallery route (compiled out of prod builds). */
export const DESIGN_SYSTEM_PATH = '/design-system';
