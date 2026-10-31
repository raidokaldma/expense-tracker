import { expect, type Page } from '@playwright/test';

export const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

/** Empties the server's database (default category tree only), or loads the 8,725-row demo set. */
export async function resetData(page: Page, demo = false) {
  const res = await page.request.post('/api/test/reset', { data: { demo } });
  expect(res.status()).toBe(204);
}

export async function openWithDemo(page: Page) {
  await resetData(page, true);
  await page.goto('/#/transactions');
  await expect(page.getByText('8725 transactions')).toBeVisible();
  await page.getByRole('grid', { name: 'Transactions' }).focus();
}
