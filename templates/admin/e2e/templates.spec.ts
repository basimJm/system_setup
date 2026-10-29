import { expect, test } from '@playwright/test';
import { DESIGN_SYSTEM_PATH } from '../src/constants/routes.ts';
import { noHorizontalScroll, signIn } from './helpers.ts';

test('page templates (English): list, detail tabs, timeline times in Amman, JSON viewer collapses', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  await page.getByRole('button', { name: /switch language|تبديل اللغة/i }).click();
  const card = page.locator('.app-card[aria-label="Page templates"]');
  await card.scrollIntoViewIfNeeded();

  await expect(card.getByRole('heading', { level: 1, name: 'Items' })).toBeVisible();
  await expect(card.getByRole('table', { name: 'Items' })).toBeVisible();
  await expect(card.getByText('1–10 of 23')).toBeVisible();

  const detailTitle = card.getByRole('heading', { level: 1, name: 'ITEM-7K2M9Q' });
  await expect(detailTitle).toBeVisible();
  await card.getByRole('tab', { name: 'Status history' }).click();
  const items = card.getByRole('list', { name: 'Status history' }).getByRole('listitem');
  await expect(items).toHaveCount(3);
  await expect(items.first()).toContainText('Marked as no-show');
  await expect(items.first()).toContainText(/4:05\s?pm/i);

  await card.getByRole('tab', { name: 'Raw data' }).click();
  const json = card.getByRole('region', { name: 'Raw data' });
  await expect(json).toContainText('ITEM_ARCHIVE');
  const summary = json.locator('summary').nth(1);
  await summary.click();
  await expect(json.locator('details').nth(1)).not.toHaveAttribute('open', '');
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('page templates (Arabic dark): side panel sits beside the body on wide screens and below it on narrow ones', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  await page.getByRole('button', { name: /dark theme|الوضع الداكن/i }).click();
  const card = page.locator('.app-card[aria-label="قوالب الصفحات"]');
  await card.scrollIntoViewIfNeeded();
  const aside = card.locator('.app-detail__aside');
  const tabs = card.locator('.app-tabs');
  await expect(aside).toBeVisible();
  const a = await aside.boundingBox();
  const t = await tabs.boundingBox();
  const wide = (page.viewportSize()?.width ?? 0) >= 1024;
  if (wide) expect(Math.abs(a!.y - t!.y)).toBeLessThan(40);
  else expect(a!.y).toBeGreaterThan(t!.y + t!.height - 1);
  await card.getByRole('tab', { name: 'سجل الحالات' }).click();
  await expect(card.getByText('لم يصل العميل خلال 30 دقيقة')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});
