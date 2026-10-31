import { describe, expect, it } from 'vitest';
import type { CategoryGroupId, CategoryId } from '../../model/types';
import {
  addGroup,
  describeChanges,
  type EditableGroup,
  moveCategory,
  nameError,
  renameItem,
  reorder,
  toSaveRequest,
  treeHas,
} from './categoryTree';

const g = (
  id: string,
  name: string,
  cats: [string, string][],
  kind: EditableGroup['kind'] = 'expense',
): EditableGroup => ({
  id: id as CategoryGroupId,
  name,
  kind,
  categories: cats.map(([cid, cname]) => ({ id: cid as CategoryId, name: cname })),
});

const saved = [
  g('food', 'Food', [
    ['groc', 'Groceries'],
    ['out', 'Eating out'],
  ]),
  g('home', 'Housing', [['rent', 'Rent']]),
];

const names = (tree: EditableGroup[]) => tree.map((x) => [x.name, x.categories.map((c) => c.name)]);

describe('category tree edits', () => {
  it('rename groups and categories without changing the tree they were given', () => {
    const renamed = renameItem(renameItem(saved, 'food', 'Meals'), 'rent', 'Mortgage');
    expect(names(renamed)).toEqual([
      ['Meals', ['Groceries', 'Eating out']],
      ['Housing', ['Mortgage']],
    ]);
    expect(saved[0].name).toBe('Food');
  });

  it('move a category to another group, and reorder within one', () => {
    expect(names(moveCategory(saved, 'out', 'home'))).toEqual([
      ['Food', ['Groceries']],
      ['Housing', ['Rent', 'Eating out']],
    ]);
    expect(names(reorder(saved, 'out', -1))[0]).toEqual(['Food', ['Eating out', 'Groceries']]);
    expect(reorder(saved, 'groc', -1)).toBe(saved);
  });

  it('reorder groups only among their kind, and add a group after the last of its kind', () => {
    const tree = [...saved, g('pay', 'Pay', [], 'income')];
    expect(names(reorder(tree, 'home', -1)).map(([n]) => n)).toEqual(['Housing', 'Food', 'Pay']);
    expect(reorder(tree, 'home', 1)).toBe(tree);
    expect(names(addGroup(tree, g('car', 'Car', []))).map(([n]) => n)).toEqual(['Food', 'Housing', 'Car', 'Pay']);
  });
});

describe('categoryTree', () => {
  it('finds groups as well as categories', () => {
    expect(treeHas(saved, 'food')).toBe(true);
    expect(treeHas(saved, 'rent')).toBe(true);
    expect(treeHas(saved, 'nope')).toBe(false);
  });

  it('keeps names unique across groups and categories', () => {
    expect(nameError(saved, ' rent ', null)).toBe('“Rent” already exists as a category in Housing');
    expect(nameError(saved, 'Rent', 'rent')).toBe('');
    expect(nameError(saved, '  ', null)).toBe('Enter a name');
  });

  it('describes renames, deletions with their reassigned transactions, and reorders', () => {
    const tree = [g('home', 'Home', [['rent', 'Rent']]), g('food', 'Food', [['groc', 'Groceries']])];
    const moves = [{ fromId: 'out' as CategoryId, toId: 'groc' as CategoryId, count: 3 }];
    expect(describeChanges(saved, tree, moves)).toEqual([
      'Renamed group “Housing” → “Home”',
      'Deleted “Eating out” — 3 transactions → Groceries',
      'Reordered expenses groups',
    ]);
  });

  it('numbers groups per kind and categories per group when saving', () => {
    const tree = [...saved, g('earn', 'Earnings', [['sal', 'Salary']], 'income')];
    const req = toSaveRequest(tree, []);
    expect(req.groups.map((x) => [x.name, x.order])).toEqual([
      ['Earnings', 0],
      ['Food', 0],
      ['Housing', 1],
    ]);
    expect(req.categories.find((c) => c.id === 'out')?.order).toBe(1);
  });
});
