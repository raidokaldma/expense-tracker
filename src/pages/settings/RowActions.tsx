import { CATEGORY_KINDS, type CategoryKind } from '../../../shared/types';
import { KIND_LABELS } from '../../model/lookup';
import type { EditableCategory, EditableGroup } from './categoryTree';
import { IconButton } from './IconButton';
import s from './RowActions.module.css';

interface GroupActionsProps {
  group: EditableGroup;
  onAdd: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function GroupActions({ group, onAdd, onRename, onDelete }: GroupActionsProps) {
  return (
    <>
      <IconButton icon="plus" label={`Add category to ${group.name}`} title="Add category (N)" onClick={onAdd} />
      <IconButton icon="pen" label={`Rename ${group.name}`} title="Rename (Enter)" onClick={onRename} />
      <IconButton icon="bin" label={`Delete ${group.name}`} title="Delete (Del)" onClick={onDelete} danger />
    </>
  );
}

interface CategoryActionsProps {
  category: EditableCategory;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}

export function CategoryActions({ category, onRename, onMove, onDelete }: CategoryActionsProps) {
  return (
    <>
      <IconButton icon="pen" label={`Rename ${category.name}`} title="Rename (Enter)" onClick={onRename} />
      <IconButton
        icon="move"
        label={`Move ${category.name} to another group`}
        title="Move to group (M)"
        onClick={onMove}
      />
      <IconButton icon="bin" label={`Delete ${category.name}`} title="Delete (Del)" onClick={onDelete} danger />
    </>
  );
}

export function KindSelect({ group, onChange }: { group: EditableGroup; onChange: (kind: CategoryKind) => void }) {
  return (
    <select
      className={s.kindSelect}
      aria-label={`Type of ${group.name}`}
      title="Type (K)"
      value={group.kind}
      onChange={(e) => onChange(e.target.value as CategoryKind)}
    >
      {CATEGORY_KINDS.map((k) => (
        <option key={k} value={k}>
          {KIND_LABELS[k]}
        </option>
      ))}
    </select>
  );
}
