import { expect, test } from '@playwright/test';
import { DESIGN_SYSTEM_PATH } from '../src/constants/routes.ts';
import { SEARCH_DEBOUNCE_MS } from '../src/constants/ui.ts';
import { noHorizontalScroll, signIn } from './helpers.ts';

test('form kit: search debounces, combobox picks by keyboard, validation messages show, save works', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  await page.getByRole('button', { name: /switch language|تبديل اللغة/i }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  const card = page.locator('.app-card[aria-label="Form kit"]');
  await card.scrollIntoViewIfNeeded();

  const search = card.getByRole('searchbox', { name: 'Search items' });
  await search.fill('sal');
  await expect(card.getByText(/Type to search/)).toBeVisible();
  await expect(card.getByText('Searching for “sal”')).toBeVisible({
    timeout: SEARCH_DEBOUNCE_MS * 4,
  });

  await card.getByLabel('Service name').fill('Hair');
  await card.getByRole('button', { name: 'Save' }).click();
  await expect(card.getByText('This field is required').first()).toBeVisible();

  const city = card.getByRole('combobox', { name: 'City' });
  await city.click();
  await city.pressSequentially('ir');
  await expect(card.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(city).toHaveValue('Irbid');

  await card.getByLabel('Price').fill('12.3456');
  await expect(card.getByLabel('Price')).toHaveValue('12.345');
  await card.getByLabel('Seats').fill('abc4');
  await expect(card.getByLabel('Seats')).toHaveValue('4');
  await card.getByLabel('Starts').fill('2026-10-10');
  await card.getByLabel('Ends').fill('2026-10-10');
  await card.getByRole('button', { name: 'Save' }).click();
  await expect(card.getByText('The end must be after the start')).toBeVisible();
  await card.getByLabel('Ends').fill('2026-10-11');
  await card.getByRole('button', { name: 'Save' }).click();
  await expect(card.getByText(/Saved/)).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('form kit in Arabic dark: multi select chips, listbox stays inside the viewport, no overflow', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: /dark theme|الوضع الداكن/i }).click();
  const card = page.locator('.app-card[aria-label="عناصر النماذج"]');
  await card.scrollIntoViewIfNeeded();
  const tags = card.getByRole('combobox', { name: 'الوسوم' });
  await tags.click();
  const list = card.getByRole('listbox');
  await expect(list).toBeVisible();
  const box = await list.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  await list.getByRole('option').first().click();
  await expect(card.locator('.app-chip')).not.toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);
});
