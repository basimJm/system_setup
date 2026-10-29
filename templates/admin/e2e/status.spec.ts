import { expect, test } from '@playwright/test';
import { DESIGN_SYSTEM_PATH } from '../src/constants/routes.ts';
import { STATUS_KINDS } from '../src/constants/status.ts';
import { noHorizontalScroll, signIn } from './helpers.ts';

test('status badges: every registered kind is shown, in Arabic then English, in both themes', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  const section = page.locator('[aria-label="شارات الحالة"]');
  await expect(section.locator('.app-row')).toHaveCount(STATUS_KINDS.length);
  await expect(section.getByText('لم يحضر')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  await page.getByRole('button', { name: /switch language|تبديل اللغة/i }).click();
  await page.getByRole('button', { name: /dark theme|الوضع الداكن/i }).click();
  const english = page.locator('[aria-label="Status badges"]');
  await expect(english.getByText('No-show')).toBeVisible();
  await expect(english.locator('.app-badge--rose').first()).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});
