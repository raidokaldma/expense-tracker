import { describe, expect, it } from 'vitest';
import type { CategoryId } from '../../shared/types';
import { toggleHidden } from './hiddenCategories';

const [a, b, c] = ['a', 'b', 'c'] as CategoryId[];

describe('toggleHidden', () => {
  it('hides the categories when any of them is shown', () => {
    expect(toggleHidden([a], [a, b])).toEqual([a, b]);
  });

  it('shows them again when all of them are hidden', () => {
    expect(toggleHidden([a, b, c], [a, b])).toEqual([c]);
  });
});
