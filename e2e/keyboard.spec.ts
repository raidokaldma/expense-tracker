import { expect, type Page, test } from '@playwright/test';
import { mod, openWithDemo, resetData } from './helpers';

const activeCell = (page: Page) =>
  page.getByRole('grid', { name: 'Transactions' }).getAttribute('aria-activedescendant');

test.beforeEach(({ page }) => resetData(page));

test('enters an amount with the keyboard only', async ({ page }) => {
  await openWithDemo(page);
  for (const k of ['ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight']) await page.keyboard.press(k);
  expect(await activeCell(page)).toBe('c-1-3');
  await page.keyboard.type('-12,5');
  await page.keyboard.press('Enter');
  await expect(page.locator('#c-1-3')).toHaveText('−12,50');
  expect(await activeCell(page)).toBe('c-2-3');
  await page.keyboard.press(`${mod}+z`);
  await expect(page.locator('#c-1-3')).toHaveText('−12,00');
});

test('Page Down moves 15 rows and the modifier jumps to the end', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('PageDown');
  expect(await activeCell(page)).toBe('c-15-0');
  await page.keyboard.press(`${mod}+ArrowDown`);
  expect(await activeCell(page)).toBe('c-8725-0');
  await expect(page.locator('#c-8725-0')).toBeInViewport();
});

test('holding the delete shortcut deletes one row only', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.down(mod);
  for (let i = 0; i < 5; i++) await page.keyboard.down('Backspace');
  await page.keyboard.up('Backspace');
  await page.keyboard.up(mod);
  await expect(page.getByText('8724 transactions')).toBeVisible();
});

test('the date editor: arrows move the date until you type', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const input = page.getByRole('textbox', { name: /^Date & time, format/ });
  await page.keyboard.press('ArrowRight');
  await expect(input).toHaveValue('20.10.2026 15:40');
  await page.keyboard.type('2');
  await expect(input).toHaveValue('2');
  await page.keyboard.press('Escape');
});

test('Find jumps to a transaction', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press(`${mod}+k`);
  await page.keyboard.type('city water 18,44');
  await page.keyboard.press('Enter');
  const id = await activeCell(page);
  await expect(page.locator(`#${id}`)).toBeInViewport();
  await expect(page.getByRole('group', { name: 'Active row' })).toContainText('City Water · −18,44');
});

test('Find on Overview selects the cell and the transaction in the side panel', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('Alt+o');
  await expect(page.getByRole('treegrid')).toBeFocused();
  // the transaction is older than the last 12 months shown, so the period widens to All
  await page.keyboard.press(`${mod}+k`);
  await page.keyboard.type('island ferries 74,86');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/overview/);
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('complementary')).toContainText('March 2025');
  const list = page.getByRole('listbox', { name: 'Transactions in this cell' });
  await expect(list).toBeFocused();
  await expect(list.getByRole('option', { selected: true })).toContainText('Island Ferries');
  await expect(list.getByRole('option', { selected: true })).toContainText('−74,86');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/transactions/);
  await expect(page.getByRole('group', { name: 'Active row' })).toContainText('Island Ferries · −74,86');
});

test('Overview opens a transaction from the side panel', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('Alt+o');
  await expect(page).toHaveURL(/#\/overview/);
  const pivot = page.getByRole('treegrid');
  await expect(pivot).toBeFocused();
  // the side panel always shows the active cell
  await expect(page.getByRole('complementary')).toContainText('Earnings');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary')).toContainText('Earnings');
  // Salary, September: one salary payment
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox', { name: 'Transactions in this cell' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/transactions$/);
  await expect(page.getByRole('group', { name: 'Active row' })).toContainText('Employer OÜ');
});

test('Overview sums the selected cells: Shift extends, the modifier and a click adds', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('Alt+o');
  await expect(page.getByRole('treegrid')).toBeFocused();
  const panel = page.getByRole('complementary');
  // Salary, October and September: September's salary
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(panel).toContainText('2 cells selected');
  await expect(panel).toContainText(/1 transaction\s*\+3 400,00/);
  // Other income, October: a payback of 25
  await page.locator('#p-2-0').click({ modifiers: ['ControlOrMeta'] });
  await expect(panel).toContainText('3 cells selected');
  await expect(panel).toContainText(/2 transactions\s*\+3 425,00/);
  await expect(page.locator('[role="gridcell"][aria-selected="true"]')).toHaveCount(3);
  // a plain move starts over
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[role="gridcell"][aria-selected="true"]')).toHaveCount(1);
  await expect(panel).not.toContainText('cells selected');
});

test('Transactions sum the filtered rows and the selected ones, and delete the selected', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('/');
  await page.keyboard.type('city water');
  await page.keyboard.press('Enter');
  const summary = page.getByText(/· \d+ shown · sum −\d/);
  await expect(summary).toBeVisible();
  const shown = Number((await summary.textContent())!.match(/(\d+) shown/)![1]);
  const bar = page.getByRole('group', { name: 'Active row' });
  // two rows by keyboard, a third with the modifier and a click
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(bar).toContainText(/2 rows selected · −\d/);
  await page.locator('#c-4-1').click({ modifiers: ['ControlOrMeta'] });
  await expect(bar).toContainText(/3 rows selected · −\d/);
  await expect(page.locator('[role="row"][aria-selected="true"]')).toHaveCount(3);
  // the modifier and Backspace delete all three; one undo brings them back
  await page.keyboard.press(`${mod}+Backspace`);
  await expect(page.getByText(`${shown - 3} shown`)).toBeVisible();
  await page.keyboard.press(`${mod}+z`);
  await expect(page.getByText(`${shown} shown`)).toBeVisible();
  // a plain move starts over
  await page.keyboard.press('ArrowDown');
  await expect(bar).toContainText('Row ');
});

test('dragging selects cells on Overview and rows on Transactions, scrolling past the edge', async ({ page }) => {
  await openWithDemo(page);
  // Transactions: from the first row down past the bottom of the grid
  const first = page.locator('#c-1-3');
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + 120, { steps: 5 });
  await expect(page.getByRole('group', { name: 'Active row' })).toContainText('5 rows selected');
  // the grid's scroll area
  const area = (await page.getByRole('grid', { name: 'Transactions' }).locator('..').boundingBox())!;
  await page.mouse.move(box.x + 10, area.y + area.height - 4);
  await expect(page.getByRole('group', { name: 'Active row' })).toContainText(/[1-9]\d{2,} rows selected/);
  await page.mouse.up();

  // Overview: a 2 × 2 block
  await page.keyboard.press('Alt+o');
  const from = (await page.locator('#p-1-0').boundingBox())!;
  const to = (await page.locator('#p-2-1').boundingBox())!;
  await page.mouse.move(from.x + 10, from.y + 10);
  await page.mouse.down();
  await page.mouse.move(to.x + 10, to.y + 10, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('complementary')).toContainText('4 cells selected');
});

test('toasts: Undo after a delete, and all rows fixed', async ({ page }) => {
  await openWithDemo(page);
  const toast = page.getByRole('status').filter({ hasText: /\S/ }).last();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press(`${mod}+Backspace`);
  await expect(page.getByText('8724 transactions')).toBeVisible();
  await expect(toast).toContainText('Row deleted');
  await toast.getByRole('button', { name: /Undo/ }).click();
  await expect(page.getByText('8725 transactions')).toBeVisible();
  // the keys still go to the grid
  await expect(page.getByRole('grid', { name: 'Transactions' })).toBeFocused();

  // fill in the category of both rows needing attention
  await page.getByRole('button', { name: '2 rows need attention' }).click();
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('ArrowDown');
    await page.keyboard.type('Groceries');
    await page.keyboard.press('Enter');
  }
  await expect(toast).toContainText('All rows fixed');
  await expect(page.getByRole('button', { name: 'Show all rows' })).toBeVisible();
});

test('Overview: the eye button hides a category and shows it again', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('Alt+o');
  const salary = page.getByRole('row').filter({ hasText: /^Salary/ });
  await salary.hover();
  await salary.getByRole('button', { name: 'Hide Salary' }).click();
  await expect(page.getByText('1 category hidden')).toBeVisible();
  await expect(salary).toHaveCount(0);
  await expect(page.getByRole('treegrid')).toBeFocused();
  // the cursor stays where it was (Earnings, the first row)
  await expect(page.locator('#p-0-0')).toHaveAttribute('aria-selected', 'true');
  // shown dimmed with Show hidden, its eye stays visible without hovering
  await page.keyboard.press('h');
  const show = page.getByRole('button', { name: 'Show Salary' });
  await expect(show).toHaveCSS('opacity', '1');
  await show.click();
  await expect(page.getByText(/categor(y|ies) hidden/)).toHaveCount(0);
});

test('Overview: C collapses every group and E expands them again', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('Alt+o');
  const table = page.getByRole('treegrid');
  // the page listens for keys once it has focused the table, which can be a moment after it is drawn
  await expect(table).toBeFocused();
  await expect(table.locator('[aria-expanded]').first()).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('c');
  await expect(table.locator('[aria-expanded="true"]')).toHaveCount(0);
  await page.keyboard.press('e');
  await expect(table.locator('[aria-expanded="false"]')).toHaveCount(0);
  await expect(page.getByRole('treegrid')).toBeFocused();
});

test('copies and pastes a cell', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openWithDemo(page);
  for (const k of ['ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight']) await page.keyboard.press(k);
  await page.keyboard.press(`${mod}+c`);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press(`${mod}+v`);
  await expect(page.locator('#c-2-3')).toHaveText('−12,00');
});

test('splits a row and types the new amount', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press(`${mod}+Shift+s`);
  await expect(page.getByRole('textbox', { name: 'Amount', exact: true })).toBeFocused();
  await page.keyboard.type('-2');
  await page.keyboard.press('Enter');
  await expect(page.getByText('8726 transactions')).toBeVisible();
  await expect(page.locator('#c-2-2')).toHaveText('Station Market');
  await expect(page.locator('#c-2-3')).toHaveText('−2,00');
});

test('renaming a category in Settings renames it on every transaction', async ({ page }) => {
  await openWithDemo(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  const tree = page.getByRole('tree');
  await expect(tree).toBeFocused();
  await page.getByRole('treeitem', { name: /^Groceries/ }).click();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Food shopping');
  await page.keyboard.press('Enter');
  await page.keyboard.press(`${mod}+s`);
  await expect(page.getByText('Categories saved')).toBeVisible();
  await page.keyboard.press('Alt+t');
  await expect(page.locator('#c-1-4')).toHaveText('Food shopping');
});

test('creates an account in Settings and uses it in the grid', async ({ page }) => {
  await openWithDemo(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('listbox', { name: 'Accounts' }).focus();
  await page.keyboard.press('n');
  await page.keyboard.type('Savings');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('option', { name: 'Savings' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await page.keyboard.press(`${mod}+a`);
  await page.keyboard.type('Rainy day');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('option', { name: 'Rainy day' })).toBeVisible();
  await page.keyboard.press('Alt+t');
  await expect(page.getByRole('grid', { name: 'Transactions' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.type('rainy');
  await page.keyboard.press('Enter');
  await expect(page.locator('#c-1-0')).toHaveText('Rainy day');
  await expect(page.getByRole('button', { name: /^Rainy day/ })).toBeVisible();
});

test('deletes an account without transactions, keeps one with', async ({ page }) => {
  await openWithDemo(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  const list = page.getByRole('listbox', { name: 'Accounts' });
  await list.focus();
  await page.keyboard.press('n');
  await page.keyboard.type('Aaa empty');
  await page.keyboard.press('Enter');
  await expect(list.getByRole('button', { name: 'Delete Aaa empty' })).toHaveCount(1);
  await page.keyboard.press('Delete');
  await expect(page.getByText('Deleted account “Aaa empty”')).toBeVisible();
  await expect(list.getByRole('option', { name: /Aaa empty/ })).toHaveCount(0);
  // the first demo account has transactions: its delete button is disabled, Del only explains why
  const first = list.getByRole('option').first();
  await expect(first.getByRole('button', { name: /^Delete/ })).toBeDisabled();
  await expect(first.getByRole('button', { name: /^Delete/ })).toHaveAttribute('title', /^Has .* transactions/);
  const before = await list.getByRole('option').count();
  await page.keyboard.press('Delete');
  await expect(page.getByText(/only an empty account can be deleted/)).toBeVisible();
  await expect(list.getByRole('option')).toHaveCount(before);
});

test('the filter button on a recipient cell shows only rows with that recipient', async ({ page }) => {
  await openWithDemo(page);
  const cell = page.locator('#c-3-2');
  const recipient = (await cell.textContent())?.trim() ?? '';
  await cell.hover();
  await cell.getByRole('button', { name: `Show only rows with “${recipient}”` }).click();
  await expect(page.getByRole('textbox', { name: 'Filter Recipient / Payer' })).toHaveValue(recipient);
  // every shown row has that recipient, and the cursor stays on the row the filter came from
  const shown = await page.locator('[role="row"] [id$="-2"]').allTextContents();
  expect(shown.slice(1).every((text) => text.includes(recipient))).toBe(true);
  await expect(page.getByRole('group', { name: 'Active row' })).toContainText(recipient);
  await expect(page.getByRole('grid', { name: 'Transactions' })).toBeFocused();
  // the × in the filter box clears it again
  await page.getByRole('button', { name: 'Clear the Recipient / Payer filter' }).click();
  await expect(page.getByRole('textbox', { name: 'Filter Recipient / Payer' })).toHaveValue('');
  await expect(page.getByText('8725 transactions · 8725 shown')).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Transactions' })).toBeFocused();
});

test('coming back to the page shows rows imported meanwhile, keeping the cursor and an open editor', async ({
  page,
}) => {
  await openWithDemo(page);
  for (const k of ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight']) await page.keyboard.press(k);
  const recipient = await page.locator(`#${await activeCell(page)}`).textContent();
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter']) await page.keyboard.press(k);
  await page.keyboard.type('Typed before');

  const res = await page.request.post('/api/transactions/import', {
    data: ['x', 'y'].map((externalId) => ({
      externalId,
      account: 'Imported',
      occurredAt: '2026-10-20T14:30:00+03:00',
      counterparty: 'Arrived meanwhile',
      amount: -100,
    })),
  });
  expect(res.status()).toBe(200);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await expect(page.getByText('2 new transactions')).toBeVisible();
  await expect(page.getByText('8727 transactions')).toBeVisible();
  await page.keyboard.type(' and after');
  await page.keyboard.press('Enter');
  const row = page.getByRole('row').filter({ hasText: 'Typed before and after' });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(recipient!);
});

test('the shortcuts dialog opens from anywhere and gives the keys back when closed', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('Alt+o');
  const table = page.getByRole('treegrid');
  await expect(table).toBeFocused();
  const period = page.getByRole('button', { name: 'Last 3 months' });
  const before = await period.getAttribute('aria-pressed');

  await page.keyboard.press(`${mod}+/`);
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();
  // the page's own keys don't act behind it
  await page.keyboard.press('p');
  await expect(period).toHaveAttribute('aria-pressed', before!);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(table).toBeFocused();

  await page.getByRole('button', { name: /Shortcuts/ }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press(`${mod}+/`);
  await expect(dialog).toHaveCount(0);
  await expect(table).toBeFocused();
});

test('⌥S opens Settings, where K lists the group types and the arrows move on afterwards', async ({ page }) => {
  await openWithDemo(page);
  await page.keyboard.press('Alt+s');
  await expect(page).toHaveURL(/#\/settings/);
  const tree = page.getByRole('tree', { name: 'Category groups and categories' });
  await expect(tree).toBeFocused();
  await page.getByRole('treeitem', { name: /^Food/ }).click();

  await page.keyboard.press('k');
  const types = page.getByRole('listbox', { name: 'Type of “Food”' });
  await expect(types).toBeFocused();
  await expect(types.getByRole('option', { selected: true })).toHaveText(/Expense/);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(types).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Type of Food' })).toHaveValue('transfer');
  await expect(tree).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('treeitem', { selected: true })).not.toHaveAccessibleName(/^Food/);

  // Esc closes the list without a change
  await page.getByRole('treeitem', { name: /^Food/ }).click();
  await page.keyboard.press('k');
  await expect(types).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(types).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Type of Food' })).toHaveValue('transfer');
  await expect(tree).toBeFocused();
});
