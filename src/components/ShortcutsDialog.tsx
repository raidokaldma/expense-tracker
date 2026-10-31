import { type KeyboardEvent, useLayoutEffect, useRef } from 'react';
import { create } from 'zustand';
import { isMod } from '../keys/keys';
import { SHORTCUT_SECTIONS } from '../keys/shortcuts';
import s from './shortcutsDialog.module.css';

const useOpen = create(() => false);
export const openShortcuts = () => useOpen.setState(true);
const close = () => useOpen.setState(false);

/**
 * Every shortcut (⌘/ or the header button). Esc, a click outside or ⌘/ closes it and gives the focus back; it also
 * closes when the focus moves on, as when ⌘K opens Find.
 */
export function ShortcutsDialog() {
  const open = useOpen();
  return open ? <Dialog /> : null;
}

function Dialog() {
  const boxRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);

  useLayoutEffect(() => {
    returnTo.current = document.activeElement;
    boxRef.current?.focus();
  }, []);

  const closeAndReturn = () => {
    close();
    if (returnTo.current instanceof HTMLElement) returnTo.current.focus({ preventScroll: true });
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // the page's own keys (P, H, …) must not act behind the dialog
    e.stopPropagation();
    if (e.key === 'Escape' || (isMod(e) && e.key === '/')) {
      e.preventDefault();
      closeAndReturn();
    }
  };

  return (
    <div
      className={s.back}
      onMouseDown={(e) => {
        // keeps the focus from moving to the page body before it goes back
        e.preventDefault();
        closeAndReturn();
      }}
    >
      <div
        className={s.box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        tabIndex={-1}
        ref={boxRef}
        onKeyDown={onKey}
        onMouseDown={(e) => e.stopPropagation()}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) close();
        }}
      >
        <h2 id="shortcuts-title" className={s.title}>
          Keyboard shortcuts
        </h2>
        <div className={s.sections}>
          {SHORTCUT_SECTIONS.map((section) => (
            <section key={section.title} className={s.section}>
              <h3>{section.title}</h3>
              <dl>
                {section.items.map((item) => (
                  <div key={item.what} className={s.item}>
                    <dt>
                      {item.keys.map((k) => (
                        <span key={k} className="kbd">
                          {k}
                        </span>
                      ))}
                    </dt>
                    <dd>{item.what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
