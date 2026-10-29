import type { Router } from 'express';

export interface Mount {
  readonly path: string;
  readonly child: Router;
}

const mounts = new WeakMap<Router, Mount[]>();

/**
 * Mounts `child` at `path` and records it, so the docs test can walk every route.
 * Use this instead of a bare `router.use(path, child)` for feature routers.
 */
export const mount = (router: Router, path: string, child: Router): void => {
  const list = mounts.get(router) ?? [];
  list.push({ path, child });
  mounts.set(router, list);
  if (path === '') router.use(child);
  else router.use(path, child);
};

export const mountsOf = (router: Router): readonly Mount[] => mounts.get(router) ?? [];
