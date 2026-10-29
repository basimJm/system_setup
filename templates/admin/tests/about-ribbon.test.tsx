import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnvRibbon } from '@/presentation/layout/EnvRibbon';
import { ENV_KEYS } from '@/constants/env';
import { HOME_ROUTE, ROUTES } from '@/constants/routes';
import { buildAppConfig } from '@/infrastructure/config/appConfig';
import ar from '@/locales/ar';
import en from '@/locales/en';
import { makeContainer, renderRoutes, renderWithApp, signInContainer } from './helpers/render';

const BUILD = { version: '3.4.5', buildId: 'c0ffee1' };
const REMOTE = {
  [ENV_KEYS.apiBaseUrl]: 'https://api.example.test',
  [ENV_KEYS.socketUrl]: 'https://socket.example.test',
};

const containerFor = (variant: string, raw: Record<string, string> = {}) => ({
  ...makeContainer(),
  config: buildAppConfig(raw, variant, BUILD),
});

afterEach(() => vi.unstubAllGlobals());

describe('EnvRibbon', () => {
  it.each(['dev-debug', 'dev-release'])('shows the DEV ribbon in %s (English)', (variant) => {
    renderWithApp(<EnvRibbon />, containerFor(variant, REMOTE));
    expect(screen.getByRole('status')).toHaveTextContent(en.env.devRibbon);
  });

  it('shows the Arabic label in Arabic', () => {
    renderWithApp(<EnvRibbon />, containerFor('dev-debug'), 'ar');
    expect(screen.getByRole('status')).toHaveTextContent(ar.env.devRibbon);
  });

  it.each(['prod-debug', 'prod-release'])('renders nothing in %s', (variant) => {
    renderWithApp(<EnvRibbon />, containerFor(variant, REMOTE));
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.querySelector('.app-env-ribbon')).toBeNull();
  });

  it('renders nothing when the bundler flag is off, even for a dev config', () => {
    vi.stubGlobal('__SHOW_ENV_RIBBON__', false);
    renderWithApp(<EnvRibbon />, containerFor('dev-debug'));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('About page', () => {
  it('redirects to login when signed out', async () => {
    const { router } = renderRoutes(ROUTES.about);
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.login));
  });

  it('shows build info for a signed-in admin (dev)', async () => {
    const container = containerFor('dev-debug');
    await signInContainer(container);
    renderRoutes(ROUTES.about, { container });
    expect(await screen.findByRole('heading', { name: en.about.title })).toBeInTheDocument();
    expect(screen.getByText(BUILD.version)).toBeInTheDocument();
    expect(screen.getByText(BUILD.buildId)).toBeInTheDocument();
    expect(screen.getByText('dev-debug')).toBeInTheDocument();
    expect(screen.getAllByText(en.about.env.dev).length).toBeGreaterThan(0);
    expect(screen.getByText(en.about.source.mock)).toBeInTheDocument();
    expect(screen.getByText(en.about.languageName.ar)).toBeInTheDocument();
  });

  it('shows the production environment and the live API source in prod', async () => {
    const container = containerFor('prod-release', REMOTE);
    await signInContainer(container);
    renderRoutes(ROUTES.about, { container });
    await screen.findByRole('heading', { name: en.about.title });
    expect(screen.getAllByText(en.about.env.prod).length).toBeGreaterThan(0);
    expect(screen.getByText(en.about.source.remote)).toBeInTheDocument();
    expect(screen.getByText('prod-release')).toBeInTheDocument();
  });

  it('never prints the API or socket URLs', async () => {
    const container = containerFor('prod-release', REMOTE);
    await signInContainer(container);
    renderRoutes(ROUTES.about, { container });
    await screen.findByRole('heading', { name: en.about.title });
    expect(document.body.textContent).not.toContain('api.example.test');
    expect(document.body.textContent).not.toContain('socket.example.test');
  });

  it('is translated in Arabic', async () => {
    const container = containerFor('dev-debug');
    await signInContainer(container);
    renderRoutes(ROUTES.about, { container, language: 'ar' });
    expect(await screen.findByRole('heading', { name: ar.about.title })).toBeInTheDocument();
    expect(screen.getByText(ar.about.version)).toBeInTheDocument();
  });

  it('is reachable from the admin menu in the top bar', async () => {
    const container = containerFor('dev-debug');
    await signInContainer(container);
    renderRoutes(HOME_ROUTE, { container });
    await userEvent.click(await screen.findByRole('button', { name: /Demo Admin|admin@/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: en.topbar.about }));
    expect(await screen.findByRole('heading', { name: en.about.title })).toBeInTheDocument();
  });
});
