import { expect, test } from '@playwright/test';
import { resetData } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('phones get read-only search and a month-by-month overview', async ({ page }) => {
  await resetData(page, true);
  await page.goto('/#/transactions');
  await page.getByRole('searchbox').fill('city water');
  await expect(page.getByRole('listitem').first()).toContainText('City Water');
  await expect(page.getByRole('grid')).toHaveCount(0);

  await page.getByRole('link', { name: 'Overview' }).click();
  await page.getByRole('button', { name: /Housing/ }).click();
  await page.getByRole('button', { name: /Utilities/ }).click();
  await expect(page.getByText('Bright Power')).toBeVisible();

  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByText('Bright Power')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next month' })).toBeEnabled();
  const month = await page.getByRole('heading', { level: 2 }).textContent();

  // switching tabs keeps the search and the month
  await page.getByRole('link', { name: 'Transactions' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('city water');
  await page.getByRole('link', { name: 'Overview' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(month!);
});

test('phones say when categories are hidden and can hide or show them', async ({ page }) => {
  await resetData(page, true);
  const { categories } = await (await page.request.get('/api/categories')).json();
  const rent = categories.find((c: { name: string }) => c.name === 'Rent');
  await page.request.patch('/api/preferences', { data: { hiddenCategoryIds: [rent.id] } });
  await page.goto('/#/overview');
  await page.getByRole('button', { name: /Housing/ }).click();
  await expect(page.getByText('1 category hidden')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Rent/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('button', { name: /^Rent/ })).toBeVisible();

  // the eye shows it again and hides another
  await page.getByRole('button', { name: 'Show Rent' }).click();
  await page.getByRole('button', { name: 'Hide Utilities' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /^Rent/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Utilities/ })).toHaveCount(0);
  await expect(page.getByText('1 category hidden')).toBeVisible();
});
