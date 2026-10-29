import { expect, type Page } from '@playwright/test';
import { MIN_PASSWORD_LENGTH, MOCK_OTP_CODE } from '../src/constants/auth.ts';
import { HOME_ROUTE, ROUTES } from '../src/constants/routes.ts';

const EMAIL = 'admin@example.com';
const PASSWORD = 'x'.repeat(MIN_PASSWORD_LENGTH);

/** Visits `target` signed out, so the guard sends us to login and back (the session is in memory only). */
export async function signIn(page: Page, target: string = ROUTES.root): Promise<void> {
  await page.goto(target);
  await expect(page).toHaveURL(new RegExp(ROUTES.login));
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.locator('input[autocomplete="one-time-code"]').fill(MOCK_OTP_CODE);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(target === ROUTES.root ? HOME_ROUTE : target));
}

export const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
