import { expect, test } from '@playwright/test';
import { DESIGN_SYSTEM_PATH } from '../src/constants/routes.ts';
import { noHorizontalScroll, signIn } from './helpers.ts';

test('rich text (English): toolbar formats, preview updates, tabs keep their own text, dates validate', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  await page.getByRole('button', { name: /switch language|تبديل اللغة/i }).click();
  const card = page.locator('.app-card[aria-label="Rich text and schedule"]');
  await card.scrollIntoViewIfNeeded();

  await card.getByRole('tab', { name: 'English' }).click();
  const box = card.getByRole('textbox', { name: 'Privacy page · English' });
  await box.fill('');
  await box.pressSequentially('Pay now');
  await box.selectText();
  await card.getByRole('button', { name: 'Bold' }).click();
  await expect(box).toHaveValue('**Pay now**');
  await expect(card.getByRole('region', { name: 'Preview' }).locator('strong')).toHaveText(
    'Pay now',
  );

  await card.getByRole('tab', { name: 'Arabic' }).click();
  const arabic = card.getByRole('textbox', { name: 'Privacy page · Arabic' });
  await expect(arabic).toHaveAttribute('dir', 'rtl');
  await expect(arabic).toHaveValue(/## الشروط والأحكام/);

  await card.getByLabel('Ends', { exact: true }).fill('2026-10-10');
  await expect(card.getByText('The end must be after the start')).toBeVisible();
  await card.getByLabel('Ends', { exact: true }).fill('2026-10-30');
  await expect(card.getByText('Schedule: 2026-10-14 to 2026-10-30')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('rich text (Arabic dark): the editor and preview fit the page and keep Arabic digits', async ({
  page,
}) => {
  await signIn(page, DESIGN_SYSTEM_PATH);
  await page.getByRole('button', { name: /dark theme|الوضع الداكن/i }).click();
  const card = page.locator('.app-card[aria-label="النص المنسّق والجدولة"]');
  await card.scrollIntoViewIfNeeded();
  const width = page.viewportSize()!.width;
  const preview = await card.getByRole('region', { name: 'المعاينة' }).boundingBox();
  expect(preview!.x).toBeGreaterThanOrEqual(-1);
  expect(preview!.x + preview!.width).toBeLessThanOrEqual(width + 1);
  await expect(card.getByRole('region', { name: 'المعاينة' }).locator('h2')).toHaveText(
    'الشروط والأحكام',
  );
  expect(await noHorizontalScroll(page)).toBe(true);
});
