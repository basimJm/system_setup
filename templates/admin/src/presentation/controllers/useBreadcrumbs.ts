import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NAV_PAGES } from '@/constants/nav';
import type { Crumb } from '../components/layout/Breadcrumbs';

/** Crumbs of the current route from the navigation tree: Module > Sub-page (just the module on a module's own page). */
export function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const page = NAV_PAGES.find((p) => p.path === pathname);
  if (!page) return [];
  const parent = page.parentId ? NAV_PAGES.find((p) => p.id === page.parentId) : undefined;
  return [
    ...(parent ? [{ label: t(parent.labelKey), to: parent.path }] : []),
    { label: t(page.labelKey) },
  ];
}
