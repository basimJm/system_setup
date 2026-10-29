import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildRoutes } from '@/app/routes';
import { DESIGN_SYSTEM_PATH, HOME_ROUTE } from '@/constants/routes';

import { MIN_PASSWORD_LENGTH, MOCK_OTP_CODE, OTP_LENGTH } from '@/constants/auth';
import { NAV_ITEMS } from '@/constants/nav';
import { ROUTES } from '@/constants/routes';
import { STORAGE_KEYS } from '@/constants/storage';

import {
  safeRedirect,
  validateCode,
  validateCredentials,
} from '@/presentation/controllers/loginValidation';
import en from '@/locales/en';
import { makeContainer, renderWithApp } from './helpers/render';

const PASSWORD = 'p'.repeat(MIN_PASSWORD_LENGTH);

function renderRoutes(path: string, showDesignSystem = true) {
  const router = createMemoryRouter(buildRoutes(showDesignSystem), { initialEntries: [path] });
  const container = makeContainer();
  const view = renderWithApp(
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>,
    container,
  );
  return { router, ...view };
}

async function signIn(container: ReturnType<typeof makeContainer>) {
  const { auth } = container.repositories;
  await auth.login('admin@example.test', PASSWORD);
  container.session.set(await auth.verifyOtp('admin@example.test', MOCK_OTP_CODE));
}

describe('login validation', () => {
  it('validates email, password length and code format', () => {
    expect(validateCredentials('bad', 'x')).toEqual({
      email: 'login.errors.email',
      password: 'login.errors.password',
    });
    expect(validateCredentials(' a@b.co ', PASSWORD)).toEqual({});
    expect(validateCode('12345')).toEqual({ code: 'login.errors.code' });
    expect(validateCode('1'.repeat(OTP_LENGTH))).toEqual({});
    expect(validateCode('12345a')).toEqual({ code: 'login.errors.code' });
  });

  it.each([
    ['/items?x=1', '/items?x=1'],
    ['//evil.example', HOME_ROUTE],
    ['https://evil.example', HOME_ROUTE],
    ['/\\evil', HOME_ROUTE],
    [null, HOME_ROUTE],
  ])('safeRedirect(%s) -> %s', (input, expected) => {
    expect(safeRedirect(input, HOME_ROUTE)).toBe(expected);
  });
});

describe('routing & auth guard', () => {
  it('redirects anonymous users to login keeping the target', async () => {
    const { router } = renderRoutes('/items?status=ACTIVE');
    await screen.findByRole('heading', { name: en.login.title });
    expect(router.state.location.pathname).toBe(ROUTES.login);
    expect(router.state.location.search).toBe(
      `?next=${encodeURIComponent('/items?status=ACTIVE')}`,
    );
  });

  it('two-step login lands on the requested page', async () => {
    const { router } = renderRoutes(`${ROUTES.login}?next=${encodeURIComponent(ROUTES.settings)}`);
    await userEvent.type(await screen.findByLabelText(en.login.email), 'admin@example.test');
    await userEvent.type(screen.getByLabelText(en.login.password), PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: en.login.continue }));
    await userEvent.type(await screen.findByLabelText(en.login.code), MOCK_OTP_CODE);
    await userEvent.click(screen.getByRole('button', { name: en.login.verify }));
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.settings));
    expect(await screen.findByRole('heading', { name: en.nav.settings })).toBeInTheDocument();
  });

  it('shows field errors without calling the repository, and a localized error for a wrong code', async () => {
    const { container } = renderRoutes(ROUTES.login);
    const login = vi.spyOn(container.repositories.auth, 'login');
    await userEvent.click(await screen.findByRole('button', { name: en.login.continue }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(login).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(en.login.email), 'admin@example.test');
    await userEvent.type(screen.getByLabelText(en.login.password), PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: en.login.continue }));
    await userEvent.type(await screen.findByLabelText(en.login.code), '0'.repeat(OTP_LENGTH));
    await userEvent.click(screen.getByRole('button', { name: en.login.verify }));
    expect(await screen.findByText(en.errors.validation)).toBeInTheDocument();
    expect(container.session.get()).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: en.common.back }));
    expect(screen.getByLabelText(en.login.email)).toBeInTheDocument();
  });

  it('signed-in users see the shell with every PRD module in the sidebar', async () => {
    const container = makeContainer();
    await signIn(container);
    const router = createMemoryRouter(buildRoutes(true), { initialEntries: [ROUTES.root] });
    renderWithApp(
      <Suspense fallback={null}>
        <RouterProvider router={router} />
      </Suspense>,
      container,
    );
    await screen.findByRole('heading', { name: en.nav.items });
    const nav = screen.getByRole('complementary', { name: en.nav.label });
    // Design sidebar: one row per module (a link, or a button that opens a group); no group is open on the home page.
    expect(nav.querySelectorAll('nav > a, nav > .app-navgroup > button')).toHaveLength(
      NAV_ITEMS.length,
    );
  });

  it('logout clears the session and returns to login', async () => {
    const container = makeContainer();
    await signIn(container);
    const router = createMemoryRouter(buildRoutes(true), { initialEntries: [ROUTES.items] });
    renderWithApp(
      <Suspense fallback={null}>
        <RouterProvider router={router} />
      </Suspense>,
      container,
    );
    await userEvent.click(await screen.findByRole('button', { name: /admin|@|test/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: en.topbar.logout }));
    await screen.findByRole('heading', { name: en.login.title });
    expect(container.session.get()).toBeNull();
  });

  it('unknown routes show the localized 404; the design gallery is dev-only', async () => {
    const container = makeContainer();
    await signIn(container);
    const open = (path: string, dev: boolean) => {
      const router = createMemoryRouter(buildRoutes(dev), { initialEntries: [path] });
      return renderWithApp(
        <Suspense fallback={null}>
          <RouterProvider router={router} />
        </Suspense>,
        container,
      );
    };
    const first = open('/nope', true);
    expect(await screen.findByText(en.notFound.title)).toBeInTheDocument();
    first.unmount();
    const prod = open(DESIGN_SYSTEM_PATH, false);
    expect(await screen.findByText(en.notFound.title)).toBeInTheDocument();
    prod.unmount();
    open(DESIGN_SYSTEM_PATH, true);
    expect(await screen.findByRole('heading', { name: en.design.title })).toBeInTheDocument();
  });
});

describe('responsive shell', () => {
  it('on phones the sidebar is an inert drawer until the menu button opens it', async () => {
    const original = { w: window.innerWidth, h: window.innerHeight };
    Object.assign(window, { innerWidth: 400, innerHeight: 800 });
    try {
      const container = makeContainer();
      await signIn(container);
      const router = createMemoryRouter(buildRoutes(true), { initialEntries: [ROUTES.items] });
      renderWithApp(
        <Suspense fallback={null}>
          <RouterProvider router={router} />
        </Suspense>,
        container,
      );
      const drawer =
        (await screen.findByRole('heading', { name: en.nav.items })) &&
        document.querySelector('aside');
      expect(drawer).toHaveAttribute('inert');
      await userEvent.click(screen.getByRole('button', { name: en.topbar.openMenu }));
      expect(drawer).not.toHaveAttribute('inert');
      await userEvent.keyboard('{Escape}');
      expect(drawer).toHaveAttribute('inert');
    } finally {
      Object.assign(window, { innerWidth: original.w, innerHeight: original.h });
    }
  });
});

describe('preferences', () => {
  it('language toggle flips direction, localizes and persists', async () => {
    const container = makeContainer();
    await signIn(container);
    const router = createMemoryRouter(buildRoutes(true), { initialEntries: [ROUTES.items] });
    renderWithApp(
      <Suspense fallback={null}>
        <RouterProvider router={router} />
      </Suspense>,
      container,
      'ar',
    );
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    await userEvent.click(await screen.findByRole('button', { name: /تبديل اللغة/ }));
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(window.localStorage.getItem(STORAGE_KEYS.language)).toBe('en');
    expect(await screen.findByRole('heading', { name: en.nav.items })).toBeInTheDocument();
  });

  it('theme toggle sets data-theme and persists', async () => {
    const container = makeContainer();
    await signIn(container);
    const router = createMemoryRouter(buildRoutes(true), { initialEntries: [ROUTES.items] });
    renderWithApp(
      <Suspense fallback={null}>
        <RouterProvider router={router} />
      </Suspense>,
      container,
    );
    await userEvent.click(await screen.findByRole('button', { name: en.topbar.darkTheme }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark');
  });
});
