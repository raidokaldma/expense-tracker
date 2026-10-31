import { describe, expect, it } from 'vitest';
import { type Cell, nextSelection, rowKeys, type Selection, selectedIds } from './selection';

const keys = ['a', 'b', 'c'];
const cols = ['m1', 'm2', 'total'];
const at = (key: string, col: string): Cell => ({ key, col });
const ids = (selection: Selection, active: Cell) => [...selectedIds(selection, active, keys, cols)].sort();

describe('cell selection', () => {
  it('is the active cell alone to start with and after a plain move', () => {
    expect(ids(null, at('b', 'm2'))).toEqual(['b|m2']);
    expect(
      nextSelection({ picked: new Set(['a|m1']), anchor: null }, at('a', 'm1'), at('b', 'm1'), 'only', keys, cols),
    ).toBe(null);
  });

  it('extends a rectangle from where the extending started', () => {
    const extended = nextSelection(null, at('a', 'm1'), at('b', 'm2'), 'extend', keys, cols);
    expect(ids(extended, at('b', 'm2'))).toEqual(['a|m1', 'a|m2', 'b|m1', 'b|m2']);
    // extending again keeps the same anchor
    const again = nextSelection(extended, at('b', 'm2'), at('a', 'm2'), 'extend', keys, cols);
    expect(ids(again, at('a', 'm2'))).toEqual(['a|m1', 'a|m2']);
  });

  it('adds and removes single cells with ⌘, keeping the rest', () => {
    const added = nextSelection(null, at('a', 'm1'), at('c', 'total'), 'toggle', keys, cols);
    expect(ids(added, at('c', 'total'))).toEqual(['a|m1', 'c|total']);
    const removed = nextSelection(added, at('c', 'total'), at('a', 'm1'), 'toggle', keys, cols);
    expect(ids(removed, at('a', 'm1'))).toEqual(['c|total']);
    // Shift then extends from the active cell, keeping the picked one
    const extended = nextSelection(removed, at('a', 'm1'), at('a', 'm2'), 'extend', keys, cols);
    expect(ids(extended, at('a', 'm2'))).toEqual(['a|m1', 'a|m2', 'c|total']);
  });

  it('leaves out cells no longer in the table', () => {
    const selection = { picked: new Set(['x|m1', 'a|m9']), anchor: null };
    expect(ids(selection, at('a', 'm1'))).toEqual([]);
  });

  it('names the rows the cells are on', () => {
    expect([...rowKeys(['g:1|m1', 'g:1|total', 'c:2|m1'])]).toEqual(['g:1', 'c:2']);
  });
});
