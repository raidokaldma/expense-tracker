import { expect, type Page } from '@playwright/test';

export const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

// the demo set ends in October 2026, so the tests that expect its months to be the latest run on this day
const DEMO_TODAY = new Date('2026-10-20T12:00:00+03:00');

/**
 * Empties the server's database (default category tree only), or loads the 8,725-row demo set and sets the browser's
 * clock to the day it was made. Call it before opening a page.
 */
export async function resetData(page: Page, demo = false) {
  const res = await page.request.post('/api/test/reset', { data: { demo } });
  expect(res.status()).toBe(204);
  if (demo) await page.clock.setFixedTime(DEMO_TODAY);
}

export async function openWithDemo(page: Page) {
  await resetData(page, true);
  await page.goto('/#/transactions');
  await expect(page.getByText('8725 transactions')).toBeVisible();
  await page.getByRole('grid', { name: 'Transactions' }).focus();
}
