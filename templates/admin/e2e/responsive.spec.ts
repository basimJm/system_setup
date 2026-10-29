import { expect, test } from '@playwright/test';
import { DESIGN_SYSTEM_PATH } from '../src/constants/routes.ts';
import { ROUTES } from '../src/constants/routes.ts';
import { noHorizontalScroll, signIn } from './helpers.ts';

test('login screen fits the viewport and is RTL Arabic by default', async ({ page }) => {
  await page.goto(ROUTES.login);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('sign in with the mock source, shell adapts, no horizontal scroll', async ({ page }) => {
  await signIn(page);
  await expect(page.locator('main')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  const bp = await page.locator('html').getAttribute('data-bp');
  const sidebar = page.locator('aside');
  if (bp === 'expanded') await expect(sidebar).toBeInViewport();
  else {
    await expect(sidebar).not.toBeInViewport();
    await page.getByRole('button', { name: /menu|القائمة/i }).click();
    await expect(sidebar).toBeInViewport();
  }
});

test('design-system gallery renders in both languages and themes without overflow', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  await expect(page.locator('h1').first()).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.getByRole('button', { name: /switch language|تبديل اللغة/i }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.getByRole('button', { name: /dark theme|الوضع الداكن/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('login page: switch language and theme at every size, brand panel only on wide screens', async ({
  page,
}) => {
  await page.goto(ROUTES.login);
  await expect(page.locator('html')).toHaveAttribute('data-bp', /.+/);
  const bp = await page.locator('html').getAttribute('data-bp');
  const brandStory = page.locator('.app-brand__headline');
  if (bp === 'expanded') await expect(brandStory).toBeVisible();
  else await expect(brandStory).toBeHidden();

  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('h1')).toHaveText('Sign in');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await noHorizontalScroll(page)).toBe(true);

  // Choices survive a reload (persisted).
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('radio', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('h1')).toHaveText('تسجيل الدخول');
  expect(await noHorizontalScroll(page)).toBe(true);
});
