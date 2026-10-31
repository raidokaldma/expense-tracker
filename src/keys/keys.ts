// Keyboard rules shared by every page, so the same key means the same thing everywhere.

export const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** ⌘ on macOS, Ctrl elsewhere. */
export function isMod(e: { metaKey: boolean; ctrlKey: boolean }) {
  return isMac ? e.metaKey : e.ctrlKey;
}

/** ⌘K on macOS, Ctrl+K elsewhere, without Alt or Shift. */
export function isModKey(e: KeyLike, key: string) {
  return isMod(e) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === key;
}

export const MOD_LABEL = isMac ? '⌘' : 'Ctrl+';
export const ALT_LABEL = isMac ? '⌥' : 'Alt+';
export const SHIFT_LABEL = isMac ? '⇧' : 'Shift+';

/** The aria-keyshortcuts value for ⌘ / Ctrl plus `key`. */
export function modAria(key: string) {
  return `${isMac ? 'Meta' : 'Control'}+${key}`;
}

const PAGE_STEP = 15;

/** The parts of a key event the keyboard rules read. */
export interface KeyLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * Vertical movement in a grid: ↑ ↓ one, ⌘↑ ⌘↓ first / last, Page Up / Down 15, ⌘Home / ⌘End first / last.
 * Plain Home / End are left to the columns. Returns the new index, or null when the key is not a movement key.
 */
export function rowMove(e: KeyLike, index: number, count: number) {
  return verticalMove(e, index, count, false);
}

/** Movement in a list: as in a grid, and plain Home / End go to the first / last item too. */
export function listMove(e: KeyLike, index: number, count: number) {
  return verticalMove(e, index, count, true);
}

function verticalMove(e: KeyLike, index: number, count: number, homeEndRows: boolean): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  const mod = isMod(e);
  switch (e.key) {
    case 'ArrowDown':
      return mod ? last : Math.min(index + 1, last);
    case 'ArrowUp':
      return mod ? 0 : Math.max(index - 1, 0);
    case 'PageDown':
      return Math.min(index + PAGE_STEP, last);
    case 'PageUp':
      return Math.max(index - PAGE_STEP, 0);
    case 'Home':
      return mod || homeEndRows ? 0 : null;
    case 'End':
      return mod || homeEndRows ? last : null;
    default:
      return null;
  }
}

/** Horizontal movement in a grid: ← → one, ⌘← ⌘→ and Home / End first / last column. */
export function colMove(e: KeyLike, index: number, count: number): number | null {
  const last = count - 1;
  const mod = isMod(e);
  switch (e.key) {
    case 'ArrowRight':
      return mod ? last : Math.min(index + 1, last);
    case 'ArrowLeft':
      return mod ? 0 : Math.max(index - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}

function isMoveKey(key: string) {
  return /^(Arrow|Page|Home$|End$|Tab$)/.test(key);
}

/**
 * A held key repeats faster than a list can redraw. Repeats are dropped until the last move has been painted,
 * so the cursor stops the moment the key is released instead of working through a backlog.
 */
export class RepeatGuard {
  private moving = false;

  blocks(e: { repeat: boolean; key: string }): boolean {
    return e.repeat && this.moving && isMoveKey(e.key);
  }

  moved() {
    this.moving = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.moving = false;
      }),
    );
  }
}

type PagePath = '/transactions' | '/overview' | '/settings';

/** ⌥T / ⌥O / ⌥S (Alt+T / Alt+O / Alt+S); matched by physical key because ⌥T types "†" on macOS. */
export function pageShortcut(e: KeyboardEvent): PagePath | null {
  if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return null;
  if (e.code === 'KeyT') return '/transactions';
  if (e.code === 'KeyO') return '/overview';
  if (e.code === 'KeyS') return '/settings';
  return null;
}

export const PAGE_KEY_LABELS = {
  transactions: `${ALT_LABEL}T`,
  overview: `${ALT_LABEL}O`,
  settings: `${ALT_LABEL}S`,
};
