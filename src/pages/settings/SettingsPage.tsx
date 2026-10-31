import { type KeyboardEvent, type MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { CATEGORY_KINDS, type CategoryGroupId, type CategoryId, type CategoryKind } from '../../../shared/types';
import { cx } from '../../components/cx';
import { PageHeader } from '../../components/PageHeader';
import { isMod, listMove } from '../../keys/keys';
import { useRepeatGuard } from '../../keys/useRepeatGuard';
import { useModShortcut } from '../../keys/useWindowKeyDown';
import { plural } from '../../model/plural';
import { showToast } from '../../store/toast';
import { AccountsCard } from './AccountsCard';
import { ChangesCard } from './ChangesCard';
import card from './card.module.css';
import { categoryTag, groupTag } from './categoryChanges';
import {
  type EditableCategory,
  type EditableGroup,
  findCategory,
  moveCategory,
  removeGroup,
  reorder,
  SECTION_TITLES,
  setGroupKind,
  treeHas,
} from './categoryTree';
import list from './list.module.css';
import { FieldError, NameField } from './NameField';
import { OptionPicker, type PickerOption } from './OptionPicker';
import { deletePicker, kindPicker, movePicker, type Picker } from './pickers';
import { CategoryActions, GroupActions, KindSelect } from './RowActions';
import s from './SettingsPage.module.css';
import { TreeRow } from './TreeRow';
import { useCategoryTreeEditor } from './useCategoryTreeEditor';
import { type Adding, addingCategory, addingGroup, useNameEditing } from './useNameEditing';
import { type TreeLine, useTreeSelection } from './useTreeSelection';

export function SettingsPage() {
  const editor = useCategoryTreeEditor();
  const { saved, tree } = editor;
  const [picker, setPicker] = useState<Picker | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const repeatGuard = useRepeatGuard();

  const focusList = useCallback(() => listRef.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    focusList();
  }, [focusList]);

  const { lines, selectedId, select, index, selected, neighbourOf } = useTreeSelection(tree, listRef);
  const names = useNameEditing({ tree, lines, change: editor.change, select, focusList });

  function closeInputs() {
    names.close();
    setPicker(null);
  }

  /** Applies a tree edit and puts the focus back on the tree. */
  function changeTree(next: EditableGroup[]) {
    editor.change(next);
    focusList();
  }

  function startRename(id: string) {
    setPicker(null);
    names.startRename(id);
  }

  function startAdding(next: Adding) {
    setPicker(null);
    names.startAdding(next);
  }

  function openPicker(next: Picker) {
    closeInputs();
    select(next.id);
    setPicker(next);
  }

  function remove(id: string) {
    const group = tree.find((g) => g.id === id);
    if (group) {
      if (group.categories.length) {
        showToast(`Move or delete the categories in “${group.name}” first`, { warn: true });
        return;
      }
      select(neighbourOf(id));
      changeTree(removeGroup(tree, id));
      return;
    }
    const found = findCategory(tree, id);
    if (!found) return;
    const count = editor.countFor(found.category.id);
    if (count) openPicker(deletePicker(tree, found, count));
    else deleteCategory(found.category.id, null);
  }

  function deleteCategory(id: CategoryId, toId: CategoryId | null) {
    select(neighbourOf(id));
    editor.deleteCategory(id, toId);
    setPicker(null);
    focusList();
  }

  function startMove(id: CategoryId) {
    const found = findCategory(tree, id);
    if (found) openPicker(movePicker(tree, found));
  }

  function confirmPicker(option: PickerOption) {
    if (!picker) return;
    setPicker(null);
    if (picker.mode === 'delete') deleteCategory(picker.id as CategoryId, option.value as CategoryId);
    else if (picker.mode === 'kind') {
      setKind(picker.id as CategoryGroupId, option.value as CategoryKind);
      focusList();
    } else changeTree(moveCategory(tree, picker.id, option.value));
  }

  function setKind(id: CategoryGroupId, kind: CategoryKind) {
    if (tree.find((g) => g.id === id)?.kind === kind) return;
    select(id);
    changeTree(setGroupKind(tree, id, kind));
  }

  async function save() {
    if (!editor.changes.length) return;
    closeInputs();
    await editor.save();
    showToast('Categories saved');
    focusList();
  }

  function discard() {
    editor.discard();
    closeInputs();
    if (!treeHas(saved, selectedId)) select(saved[0]?.id ?? null);
    showToast('Changes discarded');
    focusList();
  }

  // ⌘S saves from anywhere on the page; an open name field is finished first (its blur keeps a valid name).
  // The save runs after the blur's change has been drawn, so it has to be the `save` of that later render: the
  // ref holds it, as the key handler itself only sees this render's.
  const saveRef = useRef(save);
  saveRef.current = save;
  useModShortcut('s', () => {
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
    setTimeout(() => void saveRef.current());
  });

  /** The line a key moves the selection to, or null when the key does something else. */
  function lineFor(e: KeyboardEvent, current: TreeLine): number | null {
    const to = listMove(e, index, lines.length);
    if (to != null || isMod(e) || e.altKey) return to;
    // ← from a category goes to its group, → from a group to its first category
    if (e.key === 'ArrowLeft' && current.type === 'category') return lines.findIndex((l) => l.id === current.group.id);
    if (e.key === 'ArrowRight' && current.type === 'group' && current.group.categories.length) return index + 1;
    return null;
  }

  /** Runs the command for a plain key; false when the key has none. */
  function runLineKey(key: string, current: TreeLine): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (k === 'Enter' || k === 'F2') startRename(current.id);
    else if (k === 'n') startAdding(addingCategory(current.group.id));
    else if (k === 'g') startAdding(addingGroup(current.group.kind));
    else if (k === 'm' && current.type === 'category') startMove(current.category.id);
    else if (k === 'k') openPicker(kindPicker(current.group));
    else if (k === 'Delete' || k === 'Backspace') remove(current.id);
    else return false;
    return true;
  }

  function onTreeKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== listRef.current || !selected) return;
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      editor.change(reorder(tree, selected.id, e.key === 'ArrowUp' ? -1 : 1));
      return;
    }
    if (repeatGuard.blocks(e)) {
      e.preventDefault();
      return;
    }
    const to = lineFor(e, selected);
    if (to != null) {
      e.preventDefault();
      select(lines[to].id);
      repeatGuard.moved();
    } else if (!isMod(e) && !e.altKey && runLineKey(e.key, selected)) e.preventDefault();
  }

  function onRowMouseDown(e: MouseEvent, id: string) {
    const target = e.target as HTMLElement;
    if (['INPUT', 'SELECT', 'OPTION'].includes(target.tagName)) return;
    // buttons keep their click; anywhere else selects without taking focus from the tree
    if (!target.closest('button')) e.preventDefault();
    select(id);
    focusList();
  }

  const { rename, adding } = names;

  const nameCell = (id: string, name: string, label: string) =>
    rename?.id === id ? (
      <NameField
        label={label}
        text={rename.text}
        error={rename.error}
        onText={names.setRenameText}
        onDone={() => names.commitRename({ cancelOnError: false })}
        onCancel={names.cancel}
        onBlur={() => names.commitRename({ cancelOnError: true })}
      />
    ) : (
      <span className={list.name}>{name}</span>
    );

  const addRow = (label: string, title: string, forGroup: boolean) =>
    adding && (
      <>
        <div className={cx(list.addRow, forGroup && list.forGroup)}>
          <NameField
            label={label}
            placeholder={title}
            text={adding.text}
            error={adding.error}
            onText={names.setAddingText}
            onDone={names.commitAdd}
            onCancel={names.cancel}
            onBlur={names.blurAdding}
          />
        </div>
        <FieldError error={adding.error} />
      </>
    );

  /** What opens under a line: the rename error, or a picker. */
  const underLine = (id: string) => (
    <>
      {rename?.id === id && <FieldError error={rename.error} />}
      {picker?.id === id && (
        <OptionPicker
          title={picker.title}
          options={picker.options}
          initial={picker.initial}
          onPick={confirmPicker}
          onCancel={() => {
            setPicker(null);
            focusList();
          }}
          onDismiss={() => setPicker(null)}
        />
      )}
    </>
  );

  const savedCategories = new Map(
    saved.flatMap((group) => group.categories.map((category) => [category.id, { category, group }] as const)),
  );
  const savedGroups = new Map(saved.map((g) => [g.id, g]));

  function renderGroup(group: EditableGroup) {
    const addingHere = adding?.type === 'category' && adding.groupId === group.id;
    return (
      <TreeRow
        key={group.id}
        id={group.id}
        level={1}
        selected={selectedId === group.id}
        tag={groupTag(savedGroups.get(group.id), group)}
        name={nameCell(group.id, group.name, 'Group name')}
        onMouseDown={(e) => onRowMouseDown(e, group.id)}
        onDoubleClick={() => startRename(group.id)}
        actions={
          <GroupActions
            group={group}
            onAdd={() => startAdding(addingCategory(group.id))}
            onRename={() => startRename(group.id)}
            onDelete={() => remove(group.id)}
          />
        }
        extra={<KindSelect group={group} onChange={(kind) => setKind(group.id, kind)} />}
      >
        {underLine(group.id)}
        {group.categories.map((category) => renderCategory(group, category))}
        {!group.categories.length && !addingHere && <div className={list.emptyRow}>No categories yet</div>}
        {addingHere && addRow(`New category name in ${group.name}`, 'New category', false)}
      </TreeRow>
    );
  }

  function renderCategory(group: EditableGroup, category: EditableCategory) {
    return (
      <TreeRow
        key={category.id}
        id={category.id}
        level={2}
        selected={selectedId === category.id}
        tag={categoryTag(savedCategories.get(category.id), category, group)}
        name={nameCell(category.id, category.name, 'Category name')}
        onMouseDown={(e) => onRowMouseDown(e, category.id)}
        onDoubleClick={() => startRename(category.id)}
        actions={
          <CategoryActions
            category={category}
            onRename={() => startRename(category.id)}
            onMove={() => startMove(category.id)}
            onDelete={() => remove(category.id)}
          />
        }
      >
        {underLine(category.id)}
      </TreeRow>
    );
  }

  return (
    <>
      <PageHeader title="Settings" />
      <main className="page" style={{ maxWidth: 1200 }}>
        <div className={s.top}>
          <h2>Categories</h2>
          <div className={s.actions}>
            <button
              type="button"
              className="btn"
              onClick={() => startAdding(addingGroup(selected?.group.kind ?? 'expense'))}
              title="New group (G)"
            >
              New group
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => selected && startAdding(addingCategory(selected.group.id))}
              title="New category in the selected group (N)"
            >
              New category
            </button>
          </div>
        </div>

        <div className={s.body}>
          <div className={cx(card.card, s.main)}>
            <div
              className={list.tree}
              role="tree"
              aria-label="Category groups and categories"
              aria-activedescendant={selectedId ? `r-${selectedId}` : undefined}
              tabIndex={0}
              onKeyDown={onTreeKey}
              ref={listRef}
            >
              {CATEGORY_KINDS.map((kind) => {
                const kindGroups = tree.filter((g) => g.kind === kind);
                return (
                  <div key={kind}>
                    <div className={s.sectionHeader} role="presentation">
                      {SECTION_TITLES[kind]}{' '}
                      <span className={s.sectionCount}>{plural(kindGroups.length, 'group')}</span>
                    </div>
                    {kindGroups.map(renderGroup)}
                    {adding?.type === 'group' && adding.kind === kind && addRow('New group name', 'New group', true)}
                  </div>
                );
              })}
            </div>
          </div>

          <aside className={s.side}>
            <ChangesCard changes={editor.changes} onSave={() => void save()} onDiscard={discard} />
            <AccountsCard />
          </aside>
        </div>
      </main>
    </>
  );
}
