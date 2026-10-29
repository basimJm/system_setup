import { screen, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Language } from '@/constants/i18n';
import { axeViolations } from './helpers/axe';
import { makeContainer, renderWithApp } from './helpers/render';

/** Every module screen, loaded the way the router loads them (a default export). */
const PAGES: ReadonlyArray<readonly [string, () => Promise<{ default: ComponentType }>]> = [
  ['items', () => import('@/presentation/items/ItemsPage')],
  ['settings', () => import('@/presentation/settings/SettingsPage')],
  ['audit', () => import('@/presentation/audit/AuditPage')],
];
const LANGUAGES: readonly Language[] = ['en', 'ar'];

describe.each(LANGUAGES)('module screens in %s', (language) => {
  it.each(PAGES)('%s has no accessibility violations and names its page', async (_name, load) => {
    const { default: Page } = await load();
    renderWithApp(
      <MemoryRouter>
        <main>
          <Page />
        </main>
      </MemoryRouter>,
      makeContainer(),
      language,
    );
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument());
    expect(document.documentElement.getAttribute('dir')).toBe(language === 'ar' ? 'rtl' : 'ltr');
    // let the list/chart queries answer, then check the real content, not the skeleton
    await waitFor(
      () => expect(document.querySelector('[aria-busy="true"], .app-skeleton')).toBeNull(),
      { timeout: 3000 },
    );
    expect(await axeViolations()).toEqual([]);
  });
});
