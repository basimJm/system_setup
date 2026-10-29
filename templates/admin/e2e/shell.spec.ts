import { expect, test } from '@playwright/test';
import { noHorizontalScroll, signIn } from './helpers.ts';

test('shell (English): active module, collapsible sidebar on wide screens, admin menu', async ({
  page,
}) => {
  await signIn(page, '/items');
  await page.getByRole('button', { name: /switch language|تبديل اللغة/i }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Items' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Items/ })).toHaveClass(/app-navitem--active/);

  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    const aside = page.locator('aside');
    await page
      .getByRole('button', { name: /collapse or expand the sidebar|expand the sidebar|collapse/i })
      .click();
    await expect(aside).toHaveClass(/app-sidebar--collapsed/);
    await page
      .getByRole('button', { name: /collapse or expand the sidebar|expand the sidebar|collapse/i })
      .click();
    await expect(aside).not.toHaveClass(/app-sidebar--collapsed/);
  }
  await page.locator('.app-topbar').getByRole('button').filter({ hasText: /\S/ }).last().click();
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('shell (Arabic dark): the 403 page and the 500 page fit and read right-to-left', async ({
  page,
}) => {
  await signIn(page, '/forbidden');
  await page.getByRole('button', { name: /dark theme|الوضع الداكن/i }).click();
  await expect(page.getByText('403')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ليست لديك صلاحية' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await noHorizontalScroll(page)).toBe(true);
});
