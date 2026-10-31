import { create } from 'zustand';

interface Toast {
  text: string;
  warn: boolean;
  /** A button in the toast, such as Undo after a delete. */
  action?: ToastAction;
  seq: number;
}

interface ToastAction {
  label: string;
  /** The key that does the same, shown next to the label. */
  shortcut?: string;
  run: () => void;
}

export const useToast = create<{ toast: Toast | null }>(() => ({ toast: null }));

const SHORT_MS = 3000;
const LONG_MS = 6000;

let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * A short message at the bottom of the page, for what happened out of view or could go unnoticed (deletes, saves,
 * undo, failures); not for changes already visible where the user is looking. A newer message replaces it.
 */
export function showToast(text: string, { warn = false, action }: { warn?: boolean; action?: ToastAction } = {}) {
  clearTimeout(timer);
  useToast.setState({ toast: { text, warn, action, seq: ++seq } });
  timer = setTimeout(() => useToast.setState({ toast: null }), warn || action ? LONG_MS : SHORT_MS);
}
