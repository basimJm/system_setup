import { ROUTES, type RoutePath } from './routes';
import type { IconName } from './icons';

export interface NavItem {
  readonly id: string;
  /** i18n key under `nav.` */
  readonly labelKey: string;
  readonly path: RoutePath;
  readonly icon: IconName;
  /** Sub-pages shown under the module (Admin PRD §6). The module itself is the first page. */
  readonly children?: readonly NavChild[];
}

export interface NavChild {
  readonly id: string;
  readonly labelKey: string;
  readonly path: string;
}

/**
 * Sidebar modules in the order of the Admin PRD §6. A new module = one entry here, `nav.<id>` in both locales and a
 * page in `app/routes.tsx` (`FEATURE_PAGES`); a sub-page = a child entry + `nav.sub.<id>` (see `docs/HOW_TO_ADD_A_MODULE.md`).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'items', labelKey: 'nav.items', path: ROUTES.items, icon: 'grid' },
  { id: 'settings', labelKey: 'nav.settings', path: ROUTES.settings, icon: 'gear' },
  { id: 'audit', labelKey: 'nav.auditLog', path: ROUTES.auditLog, icon: 'shield' },
];

/** Every navigable page: the modules and their sub-pages (used to build routes and breadcrumbs). */
export const NAV_PAGES: readonly {
  id: string;
  labelKey: string;
  path: string;
  icon: IconName;
  parentId?: string;
}[] = NAV_ITEMS.flatMap((item) => [
  { id: item.id, labelKey: item.labelKey, path: item.path, icon: item.icon },
  ...(item.children ?? [])
    .filter((child) => child.path !== item.path)
    .map((child) => ({ ...child, icon: item.icon, parentId: item.id })),
]);
