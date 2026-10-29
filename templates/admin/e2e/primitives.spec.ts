import { expect, test } from '@playwright/test';
import { DESIGN_SYSTEM_PATH } from '../src/constants/routes.ts';
import { noHorizontalScroll, signIn } from './helpers.ts';

const TOOLTIP = '[role="tooltip"]';

test('gallery primitives: tooltip opens on hover and focus, closes on Escape; chip is removable; no horizontal scroll', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  const card = page.locator('.app-card[aria-label="العناصر الأساسية"]');
  const tooltip = card.locator(TOOLTIP);
  const trigger = card.locator('[aria-describedby]').first();
  await expect(tooltip).toBeHidden();

  await trigger.hover();
  await expect(tooltip).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(tooltip).toBeHidden();

  await trigger.focus();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();

  const removable = card.locator('.app-chip button');
  await expect(removable).toHaveCount(1);
  await removable.click();
  await expect(removable).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('gallery primitives render in English LTR dark without horizontal scroll', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  await page.getByRole('button', { name: /switch language|تبديل اللغة/i }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.getByRole('button', { name: /dark theme|الوضع الداكن/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await noHorizontalScroll(page)).toBe(true);
});
