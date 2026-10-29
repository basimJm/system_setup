import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/constants/routes';
import type { Language } from '@/constants/i18n';
import { axeViolations } from './helpers/axe';
import { makeContainer, renderRoutes, signInContainer } from './helpers/render';

const LANGUAGES_UNDER_TEST: readonly Language[] = ['ar', 'en'];
const SIGNED_IN_PAGES = [ROUTES.about, '/design-system', ROUTES.items, '/missing-page'];

describe('accessibility (axe-core)', () => {
  it.each(LANGUAGES_UNDER_TEST)('login page has no violations (%s)', async (language) => {
    renderRoutes(ROUTES.login, { language });
    await screen.findAllByRole('button');
    expect(await axeViolations()).toEqual([]);
  });

  it.each(SIGNED_IN_PAGES.flatMap((path) => LANGUAGES_UNDER_TEST.map((l) => [path, l] as const)))(
    '%s has no violations (%s)',
    async (path, language) => {
      const container = makeContainer();
      await signInContainer(container);
      renderRoutes(path, { container, language });
      await waitFor(() => expect(document.querySelector('main')).not.toBeNull());
      await screen.findAllByRole('heading');
      expect(await axeViolations()).toEqual([]);
    },
  );
});

describe('axe helper', () => {
  it('reports real violations so a passing run means something', async () => {
    document.body.innerHTML = '<main><img src="x.png"><button></button></main>';
    const found = await axeViolations();
    expect(found.some((line) => line.startsWith('image-alt'))).toBe(true);
    expect(found.some((line) => line.startsWith('button-name'))).toBe(true);
  });
});
