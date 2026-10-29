import { expect, test } from '@playwright/test';
import { DESIGN_SYSTEM_PATH } from '../src/constants/routes.ts';
import { noHorizontalScroll, signIn } from './helpers.ts';

test('overlay kit (English): dialogs, drawer at the end edge, menu keys, toast queue', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  await page.getByRole('button', { name: /switch language|تبديل اللغة/i }).click();
  const card = page.locator('.app-card[aria-label="Overlay kit"]');
  await card.scrollIntoViewIfNeeded();

  await card.getByRole('button', { name: 'Destructive reason' }).click();
  const dialog = page.getByRole('dialog', { name: 'Block this account' });
  await dialog.getByRole('button', { name: 'Block', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByLabel(/Reason/).fill('Repeated no-shows');
  await dialog.getByRole('button', { name: 'Block', exact: true }).click();
  await expect(card.getByText(/Last action: Destructive reason: Repeated no-shows/)).toBeVisible();

  await card.getByRole('button', { name: 'Drawer', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Details' });
  const box = await drawer.boundingBox();
  const viewport = page.viewportSize();
  expect(box!.x + box!.width).toBeCloseTo(viewport!.width, 0);
  expect(box!.width).toBeGreaterThanOrEqual(Math.min(viewport!.width, 300));
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();

  await card.getByRole('button', { name: 'Actions menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'View' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Block' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(card.getByText('Last action: Block')).toBeVisible();

  for (let i = 0; i < 5; i += 1) await card.getByRole('button', { name: 'Info toast' }).click();
  await expect(page.locator('.app-toast')).toHaveCount(3);
  await page.locator('.app-toast').first().getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.app-toast')).toHaveCount(2);
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('overlay kit (Arabic dark): the drawer opens on the left edge and fills the phone width', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  await page.getByRole('button', { name: /dark theme|الوضع الداكن/i }).click();
  const card = page.locator('.app-card[aria-label="عناصر النوافذ"]');
  await card.scrollIntoViewIfNeeded();
  await card.getByRole('button', { name: 'لوحة جانبية' }).click();
  const drawer = page.getByRole('dialog', { name: 'التفاصيل' });
  await expect(drawer).toBeVisible();
  const box = await drawer.boundingBox();
  const viewport = page.viewportSize();
  expect(box!.x).toBeCloseTo(0, 0);
  expect(box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.width).toBeGreaterThanOrEqual(Math.min(viewport!.width, 300));
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  expect(await noHorizontalScroll(page)).toBe(true);
});
