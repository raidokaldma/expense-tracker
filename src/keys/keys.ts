// Keyboard rules shared by every page, so the same key means the same thing everywhere.

export const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** ⌘ on macOS, Ctrl elsewhere. */
export const isMod = (e: { metaKey: boolean; ctrlKey: boolean }) => (isMac ? e.metaKey : e.ctrlKey);

export const MOD_LABEL = isMac ? '⌘' : 'Ctrl+';

export const PAGE_STEP = 15;

/** The parts of a key event the keyboard rules read. */
export interface KeyLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * Vertical movement in any list or grid: ↑ ↓ one, ⌘↑ ⌘↓ first / last, Page Up / Down 15, ⌘Home / ⌘End first / last.
 * Plain Home / End move rows only in lists (`homeEndRows`); in grids they move columns, in text boxes the caret.
 * Returns the new index, or null when the key is not a movement key.
 */
export function rowMove(e: KeyLike, index: number, count: number, homeEndRows = false): number | null {
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

export const isMoveKey = (key: string) => /^(Arrow|Page|Home$|End$|Tab$)/.test(key);

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

export type PagePath = '/transactions' | '/overview' | '/settings';

/** ⌥T / ⌥O / ⌥S (Alt+T / Alt+O / Alt+S); matched by physical key because ⌥T types "†" on macOS. */
export function pageShortcut(e: KeyboardEvent): PagePath | null {
  if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return null;
  if (e.code === 'KeyT') return '/transactions';
  if (e.code === 'KeyO') return '/overview';
  if (e.code === 'KeyS') return '/settings';
  return null;
}

export const PAGE_KEY_LABELS = {
  transactions: isMac ? '⌥T' : 'Alt+T',
  overview: isMac ? '⌥O' : 'Alt+O',
  settings: isMac ? '⌥S' : 'Alt+S',
};
