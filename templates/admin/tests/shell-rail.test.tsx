import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ROUTES } from '@/constants/routes';
import { STORAGE_KEYS } from '@/constants/storage';
import en from '@/locales/en';
import { makeContainer, renderRoutes, signInContainer } from './helpers/render';

const TABLET = { innerWidth: 800, innerHeight: 1024 };

/** Design `Sidebar`: under 1180 px the sidebar is the docked 76 px icon rail, not a drawer. */
describe('tablet shell = icon rail', () => {
  const original = { innerWidth: window.innerWidth, innerHeight: window.innerHeight };
  beforeEach(() => {
    Object.assign(window, TABLET);
    window.localStorage.removeItem(STORAGE_KEYS.sidebarCollapsed);
  });
  afterEach(() => Object.assign(window, original));

  const open = async () => {
    const container = makeContainer();
    await signInContainer(container);
    renderRoutes(ROUTES.items, { container });
    await screen.findByRole('heading', { name: en.nav.items });
    const aside = document.querySelector('aside');
    if (!aside) throw new Error('no sidebar');
    return aside;
  };

  it('docks the sidebar collapsed (no drawer, no menu button) when nothing was saved', async () => {
    const aside = await open();
    expect(aside).toHaveClass('app-sidebar--docked', 'app-sidebar--collapsed');
    expect(aside).not.toHaveAttribute('inert');
    expect(screen.queryByRole('button', { name: en.topbar.openMenu })).toBeNull();
  });

  it('the rail expands from its own toggle and remembers the choice', async () => {
    const aside = await open();
    await userEvent.click(screen.getByRole('button', { name: en.nav.expandSidebar }));
    expect(aside).not.toHaveClass('app-sidebar--collapsed');
    expect(window.localStorage.getItem(STORAGE_KEYS.sidebarCollapsed)).toBe('false');
  });

  it('a saved "expanded" choice wins over the tablet default', async () => {
    window.localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, 'false');
    const aside = await open();
    expect(aside).not.toHaveClass('app-sidebar--collapsed');
  });
});
