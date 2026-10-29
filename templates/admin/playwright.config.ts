import { defineConfig, devices } from '@playwright/test';

const PREVIEW_PORT = Number(process.env['E2E_PORT'] ?? 4173);
const BASE_URL = `http://127.0.0.1:${PREVIEW_PORT}`;
/** Local/offline runs may point at an already installed Chromium. */
const CHROMIUM_PATH = process.env['PW_CHROMIUM_PATH'];
const launchOptions = CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {};
const ONLY_CHROMIUM = process.env['E2E_CHROMIUM_ONLY'] === 'true';

/**
 * "Android" and "iOS" for a web panel = the browsers/viewports those platforms use:
 * Chrome on a Pixel (Chromium) and Safari on an iPhone/iPad (WebKit), portrait + landscape.
 */
const projects = [
  { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions } },
  { name: 'android-portrait', use: { ...devices['Pixel 7'], launchOptions } },
  { name: 'android-landscape', use: { ...devices['Pixel 7 landscape'], launchOptions } },
  { name: 'tablet-portrait', use: { ...devices['Galaxy Tab S4'], launchOptions } },
  ...(ONLY_CHROMIUM
    ? []
    : [
        { name: 'ios-portrait', use: { ...devices['iPhone 14'] } },
        { name: 'ios-landscape', use: { ...devices['iPhone 14 landscape'] } },
        { name: 'ipad-portrait', use: { ...devices['iPad (gen 7)'] } },
      ]),
];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects,
  webServer: {
    command: `npm run build:dev-debug && npx vite preview --mode dev-debug --outDir dist/dev-debug --host 127.0.0.1 --port ${PREVIEW_PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
