import { expect, type Page, test } from '@playwright/test';
import { mod, openWithDemo, resetData } from './helpers';

// Scenarios from the code review; each failed before its fix.

const activeCell = (page: Page) =>
  page.getByRole('grid', { name: 'Transactions' }).getAttribute('aria-activedescendant');

test.beforeEach(({ page }) => resetData(page));

test('an invalid value stays in its own cell when another cell is clicked', async ({ page }) => {
  await openWithDemo(page);
  for (const k of ['ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight']) await page.keyboard.press(k);
  await page.keyboard.type('abc');
  await page.locator('#c-3-5').click();
  expect(await activeCell(page)).toBe('c-1-3');
  await expect(page.getByRole('alert')).toContainText('Not a number');
  await page.keyboard.press('Escape');
  await expect(page.locator('#c-3-5')).not.toHaveText('abc');
});

test('clicking away from the new-row editor lands on the clicked cell', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type('Zzz shop');
  await page.locator('#c-5-3').click();
  await expect(page.getByText('8726 transactions')).toBeVisible();
  // the new row is inserted above, so the clicked row is now one further down
  await expect(page.getByRole('group', { name: 'Active row' })).not.toContainText('Zzz shop');
  expect(await activeCell(page)).toBe('c-6-3');
});

test('Find saves the value being typed first', async ({ page }) => {
  await openWithDemo(page);
  for (const k of ['ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight']) await page.keyboard.press(k);
  await page.keyboard.type('-77');
  await page.keyboard.press(`${mod}+k`);
  await page.keyboard.press('Escape');
  await expect(page.locator('#c-1-3')).toHaveText('−77,00');
});

test('"Show them" clears every filter that hides rows needing attention', async ({ page }) => {
  await openWithDemo(page);
  await page.getByRole('button', { name: /need attention/ }).click();
  await page.getByRole('textbox', { name: 'Filter Recipient / payer' }).fill('zzzz');
  await expect(page.getByText(/hidden by filters/)).toBeVisible();
  await page.getByRole('button', { name: 'Show them' }).click();
  await expect(page.getByText(/hidden by filters/)).toHaveCount(0);
  await expect(page.getByText('8725 transactions · 2 shown')).toBeVisible();
});

test('Settings: Discard keeps a selected group, ⌘S saves an open rename', async ({ page }) => {
  await openWithDemo(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('treeitem', { name: /^Food/ }).click();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Groceries & more');
  await page.keyboard.press(`${mod}+s`);
  await expect(page.getByText('Categories saved')).toBeVisible();
  await expect(page.getByRole('treeitem', { name: /^Groceries & more/ })).toBeVisible();

  // K opens the type list; ↓ Enter picks the next type
  await page.keyboard.press('k');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByRole('treeitem', { name: /^Groceries & more/ })).toHaveAttribute('aria-selected', 'true');
});

test('deleting a hidden category clears it from Overview', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('Alt+o');
  await expect(page.getByRole('treegrid')).toBeFocused();
  // hide Salary (row 2)
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('x');
  await expect(page.getByText('1 category hidden')).toBeVisible();
  // H shows hidden categories again, dimmed, wherever focus is on the page
  await page.getByRole('button', { name: 'Expand all' }).focus();
  await page.keyboard.press('h');
  await expect(page.getByRole('button', { name: 'Show hidden' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('h');
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('treeitem', { name: /^Salary/ }).click();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Enter');
  await page.keyboard.press(`${mod}+s`);
  await expect(page.getByText('Categories saved')).toBeVisible();
  await page.keyboard.press('Alt+o');
  await expect(page.getByText(/categor(y|ies) hidden/)).toHaveCount(0);
});

test('Overview periods are calendar months up to now', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('Alt+o');
  await page.getByRole('button', { name: 'Last 3 months' }).click();
  const headers = page.getByRole('columnheader');
  await expect(headers).toHaveCount(5);
});

test('renaming an account sends one request; Esc sends none', async ({ page }) => {
  const writes: string[] = [];
  page.on('console', (m) => /^(POST|PATCH) \/accounts/.test(m.text()) && writes.push(m.text().split(' ')[0]));
  await page.goto('/#/settings');
  await page.getByRole('listbox', { name: 'Accounts' }).focus();
  await page.keyboard.press('n');
  await page.keyboard.type('Wallet');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('option', { name: 'Wallet' })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Cash');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Nope');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('option', { name: 'Cash' })).toBeVisible();
  await expect.poll(() => writes).toEqual(['POST', 'PATCH']);
});

test('Overview: P while in the transactions list keeps the keys working', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('Alt+o');
  await page.getByRole('button', { name: 'Last 12 months' }).click();
  await page.keyboard.press('ArrowDown');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox', { name: 'Transactions in this cell' })).toBeFocused();
  // Last 3 months has no such month: the active cell moves, and the table takes the keys
  await page.keyboard.press('p');
  await page.keyboard.press('p');
  await expect(page.getByRole('treegrid')).toBeFocused();
});
