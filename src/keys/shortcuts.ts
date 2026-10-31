import { isMac } from './keys';

// Every shortcut in the app, for the shortcuts dialog (⌘/). Keep it in step with the key handlers.

const mod = isMac ? '⌘' : 'Ctrl+';
const alt = isMac ? '⌥' : 'Alt+';
const shift = isMac ? '⇧' : 'Shift+';

export interface Shortcut {
  /** Alternatives, each shown as its own key. */
  keys: string[];
  what: string;
}

export interface ShortcutSection {
  title: string;
  items: Shortcut[];
}

export const SHORTCUTS_KEY = `${mod}/`;

export const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: 'Everywhere',
    items: [
      { keys: [`${alt}T`], what: 'Transactions' },
      { keys: [`${alt}O`], what: 'Overview' },
      { keys: [`${alt}S`], what: 'Settings' },
      { keys: [SHORTCUTS_KEY], what: 'These shortcuts' },
      { keys: ['↑ ↓ ← →'], what: 'Move' },
      { keys: [`${mod}↑`, `${mod}↓`], what: 'First / last row' },
      { keys: ['PgUp', 'PgDn'], what: '15 rows up / down' },
      { keys: ['Home', 'End'], what: 'First / last column' },
      { keys: [`${mod}Home`, `${mod}End`], what: 'First / last cell' },
      { keys: [`${shift}↑ ↓ ← →`, `${shift}click`], what: 'Extend the selection' },
      { keys: [`${mod}click`], what: 'Add to or remove from the selection' },
    ],
  },
  {
    title: 'Transactions',
    items: [
      { keys: [`${mod}K`], what: 'Find a transaction' },
      { keys: ['Enter', 'F2'], what: 'Edit the cell; typing also starts' },
      { keys: ['Enter', `${shift}Enter`], what: 'Save, then down / up' },
      { keys: ['Tab', `${shift}Tab`], what: 'Save, then edit the next / previous cell' },
      { keys: ['Del'], what: 'Clear the cell' },
      { keys: [`${mod}D`], what: 'Fill down' },
      { keys: [`${mod}C`, `${mod}X`, `${mod}V`], what: 'Copy, cut, paste' },
      { keys: [`${mod}⌫`], what: 'Delete the selected rows' },
      { keys: [`${mod}${shift}S`], what: 'Split the row' },
      { keys: [`${mod}Z`], what: 'Undo' },
      { keys: [`${mod}${shift}Z`, `${mod}Y`], what: 'Redo' },
      { keys: ['/'], what: 'Filter this column; Esc clears it' },
    ],
  },
  {
    title: 'Date editor',
    items: [
      { keys: ['← →'], what: 'Day' },
      { keys: ['↑ ↓'], what: 'Week' },
      { keys: ['PgUp', 'PgDn'], what: 'Month' },
      { keys: ['T', 'Y', 'N'], what: 'Today, yesterday, now' },
      { keys: ['↓'], what: 'From typing back to the calendar' },
    ],
  },
  {
    title: 'Overview',
    items: [
      { keys: [`${mod}K`], what: 'Find a transaction' },
      { keys: ['P'], what: 'Next period' },
      { keys: ['F'], what: 'Choose categories' },
      { keys: ['H'], what: 'Show hidden categories' },
      { keys: ['X'], what: 'Hide or show the category' },
      { keys: ['Space'], what: 'Expand or collapse the group' },
      { keys: ['E', 'C'], what: 'Expand / collapse all' },
      { keys: ['Enter'], what: "To the cell's transactions; Enter again opens one" },
      { keys: ['Esc', '←'], what: 'Back to the table' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { keys: [`${alt}↑`, `${alt}↓`], what: 'Move the group or category up / down' },
      { keys: ['←', '→'], what: 'To the group / its first category' },
      { keys: ['Enter', 'F2'], what: 'Rename' },
      { keys: ['N'], what: 'New category, or new account' },
      { keys: ['G'], what: 'New group' },
      { keys: ['M'], what: 'Move the category to another group' },
      { keys: ['K'], what: 'Choose the group type' },
      { keys: ['Del'], what: 'Delete' },
      { keys: [`${mod}S`], what: 'Save' },
    ],
  },
];
