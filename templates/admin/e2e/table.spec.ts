import { expect, test } from '@playwright/test';
import { DESIGN_SYSTEM_PATH } from '../src/constants/routes.ts';
import { noHorizontalScroll, signIn } from './helpers.ts';

test('table v2 (English): select page, bulk bar, columns, density, paging, export', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  await page.getByRole('button', { name: /switch language|تبديل اللغة/i }).click();
  const card = page.locator('.app-card[aria-label="Data table v2"]');
  await card.scrollIntoViewIfNeeded();

  await card.getByRole('checkbox', { name: 'Select all rows on this page' }).check();
  await expect(card.getByText('25 selected')).toBeVisible();
  await card.getByRole('button', { name: 'Clear selection' }).click();
  await expect(card.getByText('25 selected')).toHaveCount(0);

  await card.getByRole('checkbox', { name: 'Select Item 2', exact: true }).check();
  await expect(card.getByText('1 selected')).toBeVisible();
  await card.getByRole('button', { name: 'Approve selected' }).click();

  await card.getByRole('button', { name: 'Columns' }).click();
  await card.getByRole('checkbox', { name: 'City' }).uncheck();
  await expect(card.getByRole('columnheader', { name: 'City' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await card.getByRole('radio', { name: 'Compact' }).check();
  await expect(card.getByRole('table')).toHaveClass(/app-table--compact/);

  await expect(card.getByText('1–25 of 47')).toBeVisible();
  await card.getByRole('button', { name: /next|التالي/i }).click();
  await expect(card.getByText('26–47 of 47')).toBeVisible();
  await card.getByRole('button', { name: 'Export' }).click();
  await expect(card.getByText('Export requested (1)')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('table v2 (Arabic dark): popover stays inside the viewport, table scrolls inside its box only', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  await page.getByRole('button', { name: /dark theme|الوضع الداكن/i }).click();
  const card = page.locator('.app-card[aria-label="جدول البيانات v2"]');
  await card.scrollIntoViewIfNeeded();
  await card.getByRole('button', { name: 'الأعمدة' }).click();
  const panel = card.getByRole('group', { name: 'الأعمدة' });
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  const viewport = page.viewportSize();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await card.getByRole('checkbox', { name: 'تحديد صالون 3', exact: true }).check();
  await expect(card.getByText('محدد: ١')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});
