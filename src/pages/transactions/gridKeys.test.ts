import { describe, expect, it } from 'vitest';
import { isMac } from '../../keys/keys';
import { gridCommand, gridMove, positionAfter } from './gridKeys';

// `mod` is the shortcut key: ⌘ on a Mac, Ctrl elsewhere; `ctrl` is Ctrl itself
type Mods = Partial<{ mod: boolean; ctrl: boolean; shift: boolean; alt: boolean; repeat: boolean }>;
const key = (k: string, mods: Mods = {}) => ({
  key: k,
  metaKey: isMac && !!mods.mod,
  ctrlKey: (!isMac && !!mods.mod) || !!mods.ctrl,
  altKey: !!mods.alt,
  shiftKey: !!mods.shift,
  repeat: !!mods.repeat,
});

describe('grid keys', () => {
  it('Tab runs along the row and wraps; Enter goes down', () => {
    expect(positionAfter({ row: 2, col: 5 }, 'right-edit', 10)).toEqual({ row: 3, col: 0 });
    expect(positionAfter({ row: 2, col: 0 }, 'left-edit', 10)).toEqual({ row: 1, col: 5 });
    expect(positionAfter({ row: 9, col: 1 }, 'down', 10)).toEqual({ row: 9, col: 1 });
    expect(gridMove(key('Tab', { shift: true }), { row: 0, col: 0 }, 10)).toBeNull();
  });

  it('moves with arrows, pages and Home / End', () => {
    expect(gridMove(key('ArrowDown'), { row: 0, col: 3 }, 10)).toEqual({ row: 1, col: 3 });
    expect(gridMove(key('End'), { row: 4, col: 0 }, 10)).toEqual({ row: 4, col: 5 });
    expect(gridMove(key('End', { mod: true }), { row: 4, col: 2 }, 10)).toEqual({ row: 9, col: 5 });
    expect(gridMove(key('a'), { row: 0, col: 0 }, 10)).toBeNull();
  });

  it('turns shortcuts into commands, a held ⌘⌫ deleting once', () => {
    expect(gridCommand(key('Enter'))).toBe('edit');
    expect(gridCommand(key('Backspace'))).toBe('clear');
    expect(gridCommand(key('Backspace', { mod: true }))).toBe('deleteRow');
    expect(gridCommand(key('Backspace', { mod: true, repeat: true }))).toBe('ignore');
    expect(gridCommand(key('z', { mod: true }))).toBe('undo');
    expect(gridCommand(key('Z', { mod: true, shift: true }))).toBe('redo');
    expect(gridCommand(key('5'))).toEqual({ typed: '5' });
    expect(gridCommand(key('@', { ctrl: true, alt: true }))).toEqual({ typed: '@' });
    expect(gridCommand(key('F2'))).toBe('edit');
    expect(gridCommand(key('Delete'))).toBe('clear');
    expect(gridCommand(key('S', { mod: true, shift: true }))).toBe('splitRow');
    expect(gridCommand(key('S', { mod: true, shift: true, repeat: true }))).toBe('ignore');
    expect(gridCommand(key('y', { mod: true }))).toBe('redo');
    expect(gridCommand(key('d', { mod: true }))).toBe('fillDown');
    expect(gridCommand(key('/'))).toBe('focusFilter');
    expect(gridCommand(key('c', { mod: true }))).toBeNull();
  });
});
