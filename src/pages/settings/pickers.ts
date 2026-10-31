import { CATEGORY_KINDS } from '../../../shared/types';
import { KIND_LABELS } from '../../model/lookup';
import { plural } from '../../model/plural';
import { type EditableCategory, type EditableGroup, groupsInOrder } from './categoryTree';
import type { PickerOption } from './OptionPicker';

/**
 * The list that opens under a row: under a category to delete it (pick where its transactions go) or move it, under
 * a group to choose its type.
 */
export interface Picker {
  mode: 'delete' | 'move' | 'kind';
  id: string;
  title: string;
  options: PickerOption[];
  initial: number;
}

interface Found {
  group: EditableGroup;
  category: EditableCategory;
}

/** Where the transactions of a deleted category go: any other category, starting in the same group. */
export function deletePicker(tree: EditableGroup[], { group, category }: Found, count: number): Picker {
  const options = groupsInOrder(tree).flatMap((g) =>
    g.categories.filter((c) => c.id !== category.id).map((c) => ({ value: c.id, label: c.name, hint: g.name })),
  );
  return {
    mode: 'delete',
    id: category.id,
    title: `Delete “${category.name}” and move its ${plural(count, 'transaction')} to`,
    options,
    initial: Math.max(
      0,
      options.findIndex((o) => o.hint === group.name),
    ),
  };
}

export function movePicker(tree: EditableGroup[], { group, category }: Found): Picker {
  const options = groupsInOrder(tree).map((g) => ({
    value: g.id,
    label: g.name,
    hint: g.id === group.id ? 'current' : KIND_LABELS[g.kind],
  }));
  return {
    mode: 'move',
    id: category.id,
    title: `Move “${category.name}” to group`,
    options,
    initial: options.findIndex((o) => o.value === group.id),
  };
}

export function kindPicker(group: EditableGroup): Picker {
  return {
    mode: 'kind',
    id: group.id,
    title: `Type of “${group.name}”`,
    options: CATEGORY_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k], hint: k === group.kind ? 'current' : '' })),
    initial: CATEGORY_KINDS.indexOf(group.kind),
  };
}
