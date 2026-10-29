import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NAV_ITEMS, NAV_PAGES } from '@/constants/nav';
import { ROUTES } from '@/constants/routes';
import { Breadcrumbs } from '@/presentation/components/layout/Breadcrumbs';
import { useBreadcrumbs } from '@/presentation/controllers/useBreadcrumbs';
import { Sidebar } from '@/presentation/layout/Sidebar';
import ForbiddenPage from '@/presentation/pages/ForbiddenPage';
import NotFoundPage from '@/presentation/pages/NotFoundPage';
import ServerErrorPage from '@/presentation/pages/ServerErrorPage';
import { ShellSection } from '@/presentation/pages/design/ShellSection';
import en from '@/locales/en';
import { axeViolations } from './helpers/axe';
import { renderWithApp } from './helpers/render';

const at = (path: string, ui: React.ReactElement) => (
  <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
);
const sidebar = (path: string, counters?: Record<string, number>, collapsed = false) =>
  renderWithApp(
    at(
      path,
      <Sidebar
        mode="docked"
        collapsed={collapsed}
        open
        onNavigate={() => undefined}
        counters={counters}
      />,
    ),
  );

describe('navigation tree', () => {
  it('every page has a unique path and an English label', () => {
    const paths = NAV_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const page of NAV_PAGES) {
      const value = page.labelKey
        .split('.')
        .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], en);
      expect(typeof value, page.labelKey).toBe('string');
    }
  });

  it('matches the PRD sidebar: one entry per module, the items module first', () => {
    expect(NAV_ITEMS.map((i) => i.id)).toEqual(['items', 'settings', 'audit']);
    expect(NAV_ITEMS.every((i) => (i.children ?? []).length === 0)).toBe(true);
  });
});

describe('Sidebar counters', () => {
  it('marks the current module and shows its counter; 99+ above 99; nothing for zero', () => {
    sidebar(ROUTES.settings, { settings: 150, items: 0 });
    expect(screen.getByRole('link', { name: /^Settings/ })).toHaveClass('app-navitem--active');
    expect(within(screen.getByRole('link', { name: /^Settings/ })).getByText('99+')).toBeVisible();
    expect(within(screen.getByRole('link', { name: /^Items/ })).queryByText('0')).toBeNull();
  });

  it('uses Arabic digits in Arabic', () => {
    renderWithApp(
      at(
        ROUTES.items,
        <Sidebar
          mode="docked"
          collapsed={false}
          open
          onNavigate={() => undefined}
          counters={{ settings: 12 }}
        />,
      ),
      undefined,
      'ar',
    );
    expect(screen.getByText('١٢')).toBeVisible();
  });

  it('a collapsed sidebar is the icon rail with counter badges', () => {
    sidebar(ROUTES.settings, { settings: 4 }, true);
    expect(screen.queryByRole('button', { name: /^(Expand|Collapse) / })).toBeNull();
    expect(within(screen.getByRole('link', { name: /^Settings/ })).getByText('4')).toBeVisible();
  });
});

describe('Breadcrumbs', () => {
  function Probe() {
    return <Breadcrumbs crumbs={useBreadcrumbs()} />;
  }
  const route = (path: string) =>
    renderWithApp(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );

  it('shows nothing on a module page or an unknown page', () => {
    const { unmount } = route(ROUTES.items);
    expect(screen.queryByRole('navigation', { name: 'Breadcrumbs' })).toBeNull();
    unmount();
    route('/nowhere');
    expect(screen.queryByRole('navigation', { name: 'Breadcrumbs' })).toBeNull();
  });
});

describe('403 / 404 / 500 pages', () => {
  it.each([
    ['403', ForbiddenPage, 'You do not have access'],
    ['404', NotFoundPage, /not found|doesn.t exist|404/i],
    ['500', ServerErrorPage, 'Something went wrong'],
  ] as const)('%s shows its code, title and a way out', (code, Page, title) => {
    renderWithApp(at('/', <Page />));
    expect(screen.getByText(code)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: title })).toBeVisible();
    expect(
      screen.queryAllByRole('link').length + screen.queryAllByRole('button').length,
    ).toBeGreaterThan(0);
  });

  it('the error page offers a reload', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    renderWithApp(at('/', <ServerErrorPage />));
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe('ShellSection (gallery)', () => {
  it('is accessible', async () => {
    renderWithApp(
      <MemoryRouter>
        <main>
          <ShellSection />
        </main>
      </MemoryRouter>,
    );
    expect(await axeViolations()).toEqual([]);
  });
});
