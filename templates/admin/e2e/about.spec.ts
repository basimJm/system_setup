import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ROUTES } from '../src/constants/routes.ts';
import { noHorizontalScroll, signIn } from './helpers.ts';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const RIBBON = '.app-env-ribbon';

test('dev build: the DEV ribbon shows on login and inside the app, and never blocks clicks', async ({
  page,
}) => {
  await page.goto(ROUTES.login);
  await expect(page.locator(RIBBON)).toBeVisible();
  await signIn(page, ROUTES.about);
  await expect(page.locator(RIBBON)).toBeVisible();
  expect(await page.locator(RIBBON).evaluate((el) => getComputedStyle(el).pointerEvents)).toBe(
    'none',
  );
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('about page shows the real version and a build id, in Arabic RTL then English LTR', async ({
  page,
}) => {
  await signIn(page, ROUTES.about);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('h1')).toHaveText('حول هذا الإصدار');
  const values = page.locator('.app-about__value');
  await expect(values.nth(0)).toHaveText(version);
  await expect(values.nth(1)).toHaveText(/^[A-Za-z0-9._-]+$/);
  await expect(values.nth(3)).toHaveText('dev-debug');
  expect(await noHorizontalScroll(page)).toBe(true);

  await page.getByRole('button', { name: /switch language|تبديل اللغة/i }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('h1')).toHaveText('About this build');
  await expect(page.locator(RIBBON)).toHaveText('DEV');
  await page.getByRole('button', { name: /dark theme|الوضع الداكن/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await noHorizontalScroll(page)).toBe(true);
});
