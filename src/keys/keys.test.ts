import { describe, expect, it } from 'vitest';
import { colMove, isMac, rowMove } from './keys';

const key = (k: string, mod = false) => ({
  key: k,
  metaKey: mod && isMac,
  ctrlKey: mod && !isMac,
  altKey: false,
  shiftKey: false,
});

describe('rowMove', () => {
  it('moves one row, 15 per page, and to the edges with the modifier', () => {
    expect(rowMove(key('ArrowDown'), 3, 100)).toBe(4);
    expect(rowMove(key('PageDown'), 3, 100)).toBe(18);
    expect(rowMove(key('PageUp'), 3, 100)).toBe(0);
    expect(rowMove(key('ArrowDown', true), 3, 100)).toBe(99);
    expect(rowMove(key('Home', true), 50, 100)).toBe(0);
  });

  it('leaves plain Home / End to columns unless asked', () => {
    expect(rowMove(key('Home'), 50, 100)).toBeNull();
    expect(rowMove(key('End'), 50, 100, true)).toBe(99);
  });
});

describe('colMove', () => {
  it('moves across columns', () => {
    expect(colMove(key('ArrowRight'), 2, 6)).toBe(3);
    expect(colMove(key('ArrowRight', true), 2, 6)).toBe(5);
    expect(colMove(key('Home'), 4, 6)).toBe(0);
  });
});
