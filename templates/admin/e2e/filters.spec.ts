import { expect, test } from '@playwright/test';
import { DESIGN_SYSTEM_PATH } from '../src/constants/routes.ts';
import { noHorizontalScroll, signIn } from './helpers.ts';

test('filter kit (English): chips, presets, custom range validation, compare, export menu', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  await page.getByRole('button', { name: /switch language|تبديل اللغة/i }).click();
  const card = page.locator('.app-card[aria-label="Filter kit"]');
  await card.scrollIntoViewIfNeeded();

  await card.getByLabel('City', { exact: true }).selectOption('irbid');
  await expect(card.getByText('City: Irbid')).toBeVisible();
  await card.getByRole('button', { name: 'Remove filter City: Irbid' }).click();
  await expect(card.getByText('City: Irbid')).toHaveCount(0);

  await card.getByLabel('Period', { exact: true }).selectOption('lastMonth');
  await expect(card.getByText('2026-09-01 – 2026-09-30')).toBeVisible();
  await card.getByRole('switch', { name: 'Compare with the previous period' }).check();
  await expect(card.getByText(/vs 2026-08-02 – 2026-08-31/)).toBeVisible();

  await card.getByLabel('Period', { exact: true }).selectOption('custom');
  await card.getByLabel('From', { exact: true }).fill('2026-10-20');
  await card.getByLabel('To', { exact: true }).fill('2026-10-10');
  await expect(card.getByText('The end must be after the start')).toBeVisible();

  await card.getByRole('button', { name: 'Export' }).click();
  await card.getByRole('button', { name: 'PDF' }).click();
  await expect(card.getByText('Exports requested: PDF')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('filter kit (Arabic dark): export menu stays inside the viewport and the page does not overflow', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  await page.getByRole('button', { name: /dark theme|الوضع الداكن/i }).click();
  const card = page.locator('.app-card[aria-label="عناصر التصفية"]');
  await card.scrollIntoViewIfNeeded();
  await card.getByRole('button', { name: 'تصدير' }).click();
  const panel = card.getByRole('group', { name: 'تصدير' });
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  const viewport = page.viewportSize();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  expect(await noHorizontalScroll(page)).toBe(true);
});
