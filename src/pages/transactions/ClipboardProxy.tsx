import type { KeyboardEvent, RefObject } from 'react';
import { isMod } from '../../keys/keys';
import s from './transactions.module.css';

// ⌘C / ⌘X / ⌘V on a grid cell. The grid is not a text field, so on the shortcut the cell's text goes into a hidden
// text box that takes focus for a moment; the browser then copies, cuts or pastes natively, with no clipboard
// permission needed, and focus goes back to the grid.

const isClipboardKey = (e: KeyboardEvent) => isMod(e) && ['c', 'x', 'v'].includes(e.key.toLowerCase());

/**
 * When `e` is ⌘C, ⌘X or ⌘V, readies the box (the cell's text to copy, or empty to paste into) and gives it focus.
 * Returns false for any other key.
 */
export function startClipboardKey(
  e: KeyboardEvent,
  box: HTMLTextAreaElement | null,
  cellText: string,
  backToGrid: () => void,
): boolean {
  if (!box || !isClipboardKey(e) || e.altKey || e.shiftKey) return false;
  const paste = e.key.toLowerCase() === 'v';
  // copying needs a selection, so an empty cell copies a space
  box.value = paste ? '' : cellText || ' ';
  box.focus({ preventScroll: true });
  box.select();
  // the browser did nothing (e.g. an empty clipboard): give focus back
  setTimeout(() => {
    if (document.activeElement === box) backToGrid();
  }, 150);
  return true;
}

interface Props {
  boxRef: RefObject<HTMLTextAreaElement | null>;
  /** A key pressed while the box still has focus, right after ⌘C; it belongs to the grid. */
  onStrayKey: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onCopied: () => void;
  onCut: () => void;
  onPaste: (text: string) => void;
}

/** The hidden text box the clipboard shortcuts go through. */
export function ClipboardProxy({ boxRef, onStrayKey, onCopied, onCut, onPaste }: Props) {
  return (
    <textarea
      className={s.clipproxy}
      aria-hidden="true"
      tabIndex={-1}
      ref={boxRef}
      onKeyDown={(e) => {
        if (!isClipboardKey(e)) onStrayKey(e);
      }}
      // after the browser has finished copying or cutting
      onCopy={() => setTimeout(onCopied)}
      onCut={() => setTimeout(onCut)}
      onPaste={(e) => {
        e.preventDefault();
        onPaste(e.clipboardData.getData('text/plain') || '');
      }}
    />
  );
}
