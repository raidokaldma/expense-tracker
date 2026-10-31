import { newAccountId, newTransactionId } from './ids.ts';
import { fromLocal, pad2, toTimestamp } from './time.ts';
import type { Account, CategoryTree, Transaction } from './types.ts';

// All names are made up.
const BANK = 'Northmere Bank';
const SAVINGS = 'Ambervale Bank';
const CASH = 'Cash';
const CARD = 'Credit card';

type Row = [account: string, local: string, counterparty: string, amount: number, category: string, desc: string];

const RECENT: Row[] = [
  [BANK, '2026-09-28T09:12', 'Employer OÜ', 3400, 'Salary', 'September salary'],
  [BANK, '2026-10-01T08:00', 'Landlord', -650, 'Rent', 'October rent'],
  [CARD, '2026-09-30T18:42', 'Green Basket Market', -48.37, 'Groceries', ''],
  [CARD, '2026-10-01T12:10', 'CityRide', -6.4, 'Transport', 'Ride to office'],
  [BANK, '2026-10-02T07:30', 'Signal Mobile', -24.99, 'Phone & internet', 'Mobile + home internet'],
  [BANK, '2026-10-03T13:05', 'Hilltop Hypermarket', -72.15, 'Groceries', 'Weekly shop'],
  [CASH, '2026-10-03T20:15', 'Café Lumen', -18.5, 'Eating out', 'Coffee & cake'],
  [BANK, '2026-10-05T10:00', 'Bright Power', -61.2, 'Utilities', 'Electricity, September'],
  [CARD, '2026-10-06T21:00', 'StreamBox', -13.99, 'Subscriptions', ''],
  [CARD, '2026-10-07T17:48', 'Fuelstop', -58, 'Fuel', ''],
  [BANK, '2026-10-08T09:00', 'Green Cross Pharmacy', -14.8, 'Health', 'Vitamins'],
  [CARD, '2026-10-09T19:30', 'Starlight Cinema', -22, 'Entertainment', 'Cinema, 2 tickets'],
  [BANK, '2026-10-10T11:20', 'Green Basket Express', -35.62, 'Groceries', ''],
  [BANK, '2026-10-11T14:02', 'Mart K.', 25, 'Other income', 'Tickets payback'],
  [CARD, '2026-10-12T08:41', 'QuickBite Delivery', -21.3, '', ''],
  [BANK, '2026-10-13T16:05', 'Corner Grocer', -41.08, 'Groceries', ''],
  [CARD, '2026-10-14T12:30', 'Regional Rail', -3.5, 'Transport', 'Tallinn – Keila'],
  [CARD, '2026-10-15T10:12', 'TuneStream', -11.99, 'Subscriptions', ''],
  [CARD, '2026-10-16T19:55', 'Threads Fashion', -59.95, 'Shopping', ''],
  [BANK, '2026-10-17T09:30', 'City Water', -18.44, 'Utilities', ''],
  [CARD, '2026-10-18T13:15', 'Supper Courier', -27.4, '', ''],
  [CASH, '2026-10-19T15:40', 'Station Market', -12, 'Groceries', 'Vegetables'],
];

// category: [counterparties, per month, min, max, accounts]
type Pattern = [string[], number, number, number, string[]];
const PATTERNS: Record<string, Pattern> = {
  Groceries: [
    [
      'Green Basket Market',
      'Hilltop Hypermarket',
      'Corner Grocer',
      'Green Basket Express',
      'Daily Pantry',
      'Harbour Foods',
      'Village Store',
      'Seaside Grocer',
    ],
    26,
    4,
    38,
    [BANK, BANK, CARD, CASH],
  ],
  'Eating out': [
    [
      'Café Lumen',
      'QuickBite Delivery',
      'Supper Courier',
      'Noodle Corner',
      'Old Town Bistro',
      'Pasta Pronto',
      'Morning Cup Café',
      'Burger Barn',
    ],
    14,
    3,
    28,
    [CARD, CASH, BANK],
  ],
  Transport: [['CityRide', 'Regional Rail', 'City Transit', 'RideNow', 'Park & Go'], 20, 1.5, 9, [CARD, BANK]],
  Fuel: [['Fuelstop', 'Northway Fuel', 'Roadside Petrol', 'Highway Station'], 3, 35, 65, [CARD]],
  Utilities: [['Bright Power', 'City Water', 'Spark Electric', 'Warm Homes Heating'], 4, 15, 75, [BANK]],
  Health: [['Green Cross Pharmacy', 'Family Pharmacy', 'Health Centre', 'Smile Dental'], 2.5, 6, 45, [BANK, CARD]],
  Shopping: [
    [
      'Threads Fashion',
      'Grand Department Store',
      'Home Shop Online',
      'Gadget House',
      'Nordic Home',
      'Builders Yard',
      'Parcel Bazaar',
      'Active Sports',
    ],
    7,
    9,
    70,
    [CARD, BANK],
  ],
  Entertainment: [['Starlight Cinema', 'TicketHub', 'GameVault', 'Art Museum', 'Photo Gallery'], 4, 6, 30, [CARD]],
  Gifts: [
    ['Grand Department Store', 'Page Turner Books', 'Rose Florist', 'City Centre Mall'],
    0.8,
    15,
    60,
    [CARD, CASH],
  ],
  Travel: [
    ['SkyWings Air', 'StayFinder', 'Baltic Ferry Line', 'BudgetJet', 'Cosy Rentals', 'Island Ferries'],
    0.7,
    40,
    320,
    [CARD],
  ],
  'Other income': [['Mart K.', 'Marketplace buyer', 'Kristi T.', 'Auction buyer'], 0.6, -120, -10, [BANK]],
};

/** Coffee, snacks and bus tickets: the many small rows that make up most of a real month. */
const SMALL: Pattern = [
  ['Morning Cup Café', 'Corner Grocer', 'Station Market', 'Café Lumen'],
  0,
  2,
  9,
  [CARD, CASH, BANK],
];

const TOTAL = 8725;

/**
 * 8,725 seeded demo transactions (Jan 2021 – Oct 2026), using the given category tree by name.
 * Money moves like in real life: salary and bills on the bank account, ATM withdrawals for cash, the credit card
 * repaid every month, the surplus saved and the savings invested, so every balance ends believable: the accounts
 * between 0 and 10 000, the credit card between −10 000 and 0. Two recent rows have no category, so "needs
 * attention" has something to show.
 */
export function demoData(tree: CategoryTree): { accounts: Account[]; transactions: Transaction[] } {
  // the transfers that keep balances in range vary in number, so the small purchases make up the difference
  let small = 2000;
  let rows = generate(small);
  for (let i = 0; i < 50 && rows.length !== TOTAL; i++) {
    small += TOTAL - rows.length;
    rows = generate(small);
  }
  if (rows.length !== TOTAL) throw new Error(`Demo data has ${rows.length} rows, not ${TOTAL}`);

  const accounts = new Map<string, Account>();
  const accountFor = (name: string) => {
    let a = accounts.get(name);
    if (!a) {
      a = { id: newAccountId(), name, importKey: name };
      accounts.set(name, a);
    }
    return a.id;
  };
  const categoryByName = new Map(tree.categories.map((c) => [c.name, c.id]));
  const transactions = rows.map(([account, local, who, amount, category, desc], i): Transaction => {
    const [date, time] = local.split('T');
    const [y, mo, d] = date.split('-').map(Number);
    const [h, mi] = time.split(':').map(Number);
    const occurredAt = fromLocal({ y, mo, d, h, mi });
    return {
      id: newTransactionId(),
      externalId: `demo-${i + 1}`,
      accountId: accountFor(account),
      occurredAt,
      counterparty: who,
      amount: Math.round(amount * 100),
      categoryId: categoryByName.get(category) ?? null,
      description: desc || null,
      addedAt: occurredAt,
      updatedAt: toTimestamp(Date.now()),
    };
  });
  return { accounts: [...accounts.values()], transactions };
}

/** A seeded random number generator: the same seed gives the same sequence. */
function random(seed: number) {
  return () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
}

function generate(smallCount: number): Row[] {
  // one sequence each for everyday rows, small purchases and transfers, so more small purchases change nothing else
  const everydayRnd = random(20261020);
  const smallRnd = random(1234567);
  const moveRnd = random(7654321);
  let rnd = everydayRnd;
  const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const cents = (n: number) => Math.round(n * 100) / 100;

  const rows: Row[] = [...RECENT];
  const add = (
    month: string,
    day: number,
    account: string,
    who: string,
    amount: number,
    category: string,
    desc = '',
    time?: string,
  ) => {
    const at = time ?? `${pad2(8 + Math.floor(rnd() * 13))}:${pad2(Math.floor(rnd() * 60))}`;
    rows.push([account, `${month}-${pad2(day)}T${at}`, who, cents(amount), category, desc]);
  };
  const spend = (month: string, [who, , lo, hi, accounts]: Pattern, category: string) =>
    add(month, 1 + Math.floor(rnd() * 27), pick(accounts), pick(who), -between(lo, hi), category);
  /** Both sides of a move between own accounts (or out to the fund). */
  const transfer = (
    month: string,
    day: number,
    time: string,
    from: string,
    to: string | null,
    amount: number,
    desc: string,
  ) => {
    add(month, day, from, to ?? 'Index fund', -amount, 'Transfer', desc, time);
    if (to) add(month, day, to, from, amount, 'Transfer', desc, time);
  };

  const months: string[] = [];
  for (let y = 2021; y <= 2026; y++)
    for (let m = 1; m <= 12; m++) if (y < 2026 || m <= 9) months.push(`${y}-${pad2(m)}`);

  // everyday income and spending
  months.forEach((m, mi) => {
    for (const [category, pattern] of Object.entries(PATTERNS)) {
      const n = Math.floor(pattern[1] * (0.8 + rnd() * 0.4) + rnd());
      for (let i = 0; i < n; i++) spend(m, pattern, category);
    }
    add(m, 1, BANK, 'Landlord', m < '2023-06' ? -590 : -650, 'Rent', 'Monthly rent');
    add(m, 2, BANK, 'Signal Mobile', -24.99, 'Phone & internet', 'Mobile + home internet');
    add(m, 6, CARD, 'StreamBox', m < '2024-01' ? -10.99 : -13.99, 'Subscriptions');
    add(m, 15, CARD, 'TuneStream', m < '2024-07' ? -9.99 : -11.99, 'Subscriptions');
    // September's salary is among the recent rows
    if (mi < months.length - 1)
      add(m, 28, BANK, 'Employer OÜ', m < '2023-01' ? 2900 : m < '2025-01' ? 3150 : 3400, 'Salary', 'Monthly salary');
  });
  rnd = smallRnd;
  for (let i = 0; i < smallCount; i++) spend(pick(months), SMALL, rnd() < 0.6 ? 'Eating out' : 'Groceries');
  rnd = moveRnd;

  // month by month, the moves between accounts that a careful person makes
  const balance: Record<string, number> = { [BANK]: 0, [SAVINGS]: 0, [CASH]: 0, [CARD]: 0 };
  const monthOf = (r: Row) => r[1].slice(0, 7);
  const everyday = rows.slice();
  for (const m of [...months, '2026-10']) {
    for (const r of everyday) if (monthOf(r) === m) balance[r[0]] += r[3];
    const move = (from: string, to: string | null, amount: number) => {
      balance[from] -= amount;
      if (to) balance[to] += amount;
    };
    // cash for the month, taken out at the start
    const cash = Math.ceil((Math.max(0, -balance[CASH]) + between(30, 150)) / 20) * 20;
    transfer(m, 2, '09:05', BANK, CASH, cash, 'ATM withdrawal');
    move(BANK, CASH, cash);
    if (m === '2026-10') break; // the current month is not over yet

    // the card bill, leaving a little for next month
    const debt = -balance[CARD];
    const pay = cents(debt - between(0, Math.min(600, debt / 2)));
    if (pay > 0) {
      transfer(m, 28, '21:10', BANK, CARD, pay, 'Card repayment');
      move(BANK, CARD, pay);
    }
    // what is left over goes to savings; a short month is covered from them
    const keep = between(1200, 2600);
    if (balance[BANK] > keep + 50) {
      const amount = Math.floor((balance[BANK] - keep) / 10) * 10;
      transfer(m, 28, '21:20', BANK, SAVINGS, amount, 'To savings');
      move(BANK, SAVINGS, amount);
    } else if (balance[BANK] < 300 && balance[SAVINGS] > 0) {
      const amount = Math.min(balance[SAVINGS], Math.ceil((keep - balance[BANK]) / 10) * 10);
      transfer(m, 28, '21:20', SAVINGS, BANK, amount, 'From savings');
      move(SAVINGS, BANK, amount);
    }
    // and savings above a cushion are invested
    if (balance[SAVINGS] > 9000) {
      const amount = Math.floor((balance[SAVINGS] - between(4000, 6000)) / 100) * 100;
      transfer(m, 29, '10:00', SAVINGS, null, amount, 'Fund investment');
      move(SAVINGS, null, amount);
    }
  }
  return rows;
}
