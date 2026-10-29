import type { Router } from 'express';
import { mountsOf } from '../../src/routes/mount';

interface RouteLayer {
  readonly route?: { readonly path: string; readonly methods: Record<string, boolean> };
  readonly handle?: unknown;
}

const stackOf = (router: unknown): RouteLayer[] =>
  typeof router === 'function' && 'stack' in router && Array.isArray(router.stack)
    ? (router.stack as RouteLayer[])
    : [];

const normalize = (path: string): string => {
  const joined = path.replace(/:(\w+)/g, '{$1}');
  return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
};

export interface RouteWalk {
  /** `"get /customer/v1/x/{id}"` entries for every route reachable through `mount()`. */
  readonly routes: Set<string>;
  /** Routers that are attached without `mount()`, so their routes cannot be checked. */
  readonly unmounted: number;
}

/** Walks a router tree built with `mount()` and lists every `method path` it serves. */
export const walkRoutes = (router: Router, prefix = ''): RouteWalk => {
  const routes = new Set<string>();
  let unmounted = 0;
  const mounted = new Set<unknown>(mountsOf(router).map((m) => m.child));
  for (const layer of stackOf(router)) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        routes.add(`${method} ${normalize(`${prefix}${layer.route.path}`)}`);
      }
    } else if (stackOf(layer.handle).length > 0 && !mounted.has(layer.handle)) {
      unmounted += 1;
    }
  }
  for (const { path, child } of mountsOf(router)) {
    const inner = walkRoutes(child, `${prefix}${path}`);
    inner.routes.forEach((route) => routes.add(route));
    unmounted += inner.unmounted;
  }
  return { routes, unmounted };
};

export interface DocDiff {
  readonly undocumented: string[];
  readonly withoutRoute: string[];
}

/** Routes missing from the OpenAPI documents, and documented paths that have no route. */
export const diffRoutesAndDocs = (routes: Set<string>, documented: Set<string>): DocDiff => ({
  undocumented: [...routes].filter((route) => !documented.has(route)).sort(),
  withoutRoute: [...documented].filter((entry) => !routes.has(entry)).sort(),
});
