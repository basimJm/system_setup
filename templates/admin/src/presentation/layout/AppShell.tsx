import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useContainer } from '@/app/ContainerContext';
import { STORAGE_KEYS } from '@/constants/storage';
import { safeStorage } from '@/infrastructure/storage/safeStorage';
import { Suspense } from 'react';
import { Spinner } from '../components/feedback/Spinner';
import { useSession } from '../controllers/useSession';
import { useViewport } from '../hooks/useViewport';
import { IdleWarningDialog } from '../components/feedback/IdleWarningDialog';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { useProactiveRefresh } from '../hooks/useProactiveRefresh';
import { useRealtimeConnection } from '../hooks/useRealtime';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { useBreadcrumbs } from '../controllers/useBreadcrumbs';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const TRUE = 'true';

/** Sidebar is docked (collapsible; the icon rail by default on tablets) and a slide-in drawer on phones. */
export function AppShell() {
  const { breakpoint } = useViewport();
  const { sessionManager } = useContainer();
  const current = useSession();
  const location = useLocation();
  const crumbs = useBreadcrumbs();
  // Design `Sidebar`: under 1180 px the sidebar stays docked as the 76 px icon rail; phones keep the drawer
  // because rail + content overflow a 375 px screen (measured, ADM-099).
  const docked = breakpoint !== 'compact';
  const [collapsedPref, setCollapsed] = useState<boolean | null>(() => {
    const stored = safeStorage.get(STORAGE_KEYS.sidebarCollapsed);
    return stored === null ? null : stored === TRUE;
  });
  // No saved choice: collapsed on tablets (design `pref.collapsed ?? narrow`), expanded on desktops.
  const collapsed = collapsedPref ?? breakpoint !== 'expanded';
  // The drawer is tied to the page it was opened on, so navigating (or resizing to docked) closes it.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const drawerOpen = !docked && drawerPath === location.pathname;
  const setDrawerOpen = useCallback(
    (open: boolean) => setDrawerPath(open ? location.pathname : null),
    [location.pathname],
  );

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, setDrawerOpen]);

  const onMenu = useCallback(() => {
    if (docked) {
      const next = !collapsed;
      safeStorage.set(STORAGE_KEYS.sidebarCollapsed, String(next));
      setCollapsed(next);
    } else {
      setDrawerOpen(!drawerOpen);
    }
  }, [docked, collapsed, drawerOpen, setDrawerOpen]);

  const onLogout = useCallback(() => {
    void sessionManager.signOut();
  }, [sessionManager]);

  useRealtimeConnection(current !== null);
  useProactiveRefresh(current);
  const { status: idle, stay } = useIdleTimeout({
    onExpire: () => void sessionManager.signOut('idle'),
    enabled: current !== null,
  });

  return (
    <div className="app-shell" data-docked={docked} data-collapsed={docked && collapsed}>
      <Sidebar
        mode={docked ? 'docked' : 'drawer'}
        collapsed={collapsed}
        open={drawerOpen}
        onNavigate={() => setDrawerOpen(false)}
        {...(current ? { admin: { name: current.admin.name, email: current.admin.email } } : {})}
        {...(docked ? { onToggleCollapse: onMenu } : {})}
      />
      {drawerOpen && !docked ? (
        <button
          type="button"
          className="app-backdrop"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}
      <IdleWarningDialog
        open={idle.state === 'warning'}
        secondsLeft={idle.secondsLeft}
        onStay={stay}
        onSignOut={onLogout}
      />
      <div className="app-shell__main">
        <Topbar
          adminName={current?.admin.name ?? ''}
          {...(current ? { adminEmail: current.admin.email } : {})}
          showMenuButton={!docked}
          menuLabelKey={docked ? 'topbar.toggleSidebar' : 'topbar.openMenu'}
          menuExpanded={docked ? !collapsed : drawerOpen}
          onMenu={onMenu}
          onLogout={onLogout}
        />
        <main id="main" className="app-content">
          <Breadcrumbs crumbs={crumbs} />
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
