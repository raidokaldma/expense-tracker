import { type KeyboardEvent, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../../components/AppShell';
import { cx } from '../../components/cx';
import { keepInWindow } from '../../components/scroll';
import { isMod, RepeatGuard, rowMove } from '../../keys/keys';
import { useWindowKeyDown } from '../../keys/useWindowKeyDown';
import { countBy } from '../../model/countBy';
import { newCategoryGroupId, newCategoryId } from '../../model/ids';
import { KIND_LABELS, KINDS } from '../../model/lookup';
import { plural } from '../../model/plural';
import type { CategoryGroupId, CategoryId, CategoryKind } from '../../model/types';
import { saveCategories, showToast, useStore } from '../../store/store';
import { AccountsCard } from './AccountsCard';
import { ChangesCard } from './ChangesCard';
import {
  addCategory,
  addGroup,
  describeChanges,
  type EditableCategory,
  type EditableGroup,
  editableTree,
  findCategory,
  groupsInOrder,
  moveCategory,
  nameError,
  type Reassignment,
  removeCategory,
  removeGroup,
  renameItem,
  reorder,
  SECTION_TITLES,
  setGroupKind,
  toSaveRequest,
  treeHas,
} from './categoryTree';
import { IconButton } from './IconButton';
import { FieldError, NameField } from './NameField';
import { OptionPicker, type PickerOption } from './OptionPicker';
import s from './settings.module.css';

/** A line of the tree: a group or one of its categories. */
type Row =
  | { type: 'group'; id: string; group: EditableGroup }
  | { type: 'category'; id: string; group: EditableGroup; category: EditableCategory };

/** Renaming a group or category in place. */
type Rename = { id: string; text: string; error: string };

/** The add row under a group (new category) or under a section (new group). */
type Adding =
  | { type: 'category'; groupId: CategoryGroupId; text: string; error: string }
  | { type: 'group'; kind: CategoryKind; text: string; error: string };

/**
 * The list that opens under a row: under a category to delete it (pick where its transactions go) or move it, under
 * a group to choose its type.
 */
interface Picker {
  mode: 'delete' | 'move' | 'kind';
  id: string;
  title: string;
  options: PickerOption[];
  initial: number;
}

export function SettingsPage() {
  const groups = useStore((st) => st.groups);
  const categories = useStore((st) => st.categories);
  const transactions = useStore((st) => st.transactions);

  const saved = useMemo(() => editableTree(groups, categories), [groups, categories]);
  const savedCounts = useMemo(() => countBy(transactions, (t) => t.categoryId), [transactions]);

  const [tree, setTree] = useState<EditableGroup[]>(saved);
  const [moves, setMoves] = useState<Reassignment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(saved[0]?.id ?? null);
  const [rename, setRename] = useState<Rename | null>(null);
  const [adding, setAdding] = useState<Adding | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const repeatGuard = useRef(new RepeatGuard()).current;
  // unsaved edits survive a reload of the data; only Save, Discard or untouched state take the stored tree
  const edited = useRef(false);

  useEffect(() => {
    if (edited.current) return;
    setTree(saved);
    setMoves([]);
  }, [saved]);

  // the tree edits return the same tree when there is nothing to change (e.g. moving the top row up)
  const changeTree = (next: EditableGroup[], nextMoves = moves) => {
    if (next === tree && nextMoves === moves) return;
    edited.current = true;
    setTree(next);
    setMoves(nextMoves);
  };

  const focusList = useCallback(() => listRef.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    focusList();
  }, [focusList]);

  const countFor = (id: CategoryId) =>
    (savedCounts.get(id) || 0) + moves.filter((m) => m.toId === id).reduce((sum, m) => sum + m.count, 0);

  const rows: Row[] = useMemo(
    () =>
      groupsInOrder(tree).flatMap((group) => [
        { type: 'group' as const, id: group.id, group },
        ...group.categories.map((category) => ({ type: 'category' as const, id: category.id, group, category })),
      ]),
    [tree],
  );
  const rowIndex = Math.max(
    0,
    rows.findIndex((r) => r.id === selectedId),
  );
  const row = rows[rowIndex];

  // the page scrolls so the selected row stays in view
  // biome-ignore lint/correctness/useExhaustiveDependencies: reads the DOM after the selection has been drawn
  useEffect(() => {
    keepInWindow(listRef.current?.querySelector('[role="treeitem"][aria-selected="true"]'));
  }, [selectedId]);

  const neighbourOf = (id: string) => {
    const i = rows.findIndex((r) => r.id === id);
    return (rows[i + 1] ?? rows[i - 1])?.id ?? null;
  };

  const closeInputs = () => {
    setRename(null);
    setAdding(null);
    setPicker(null);
  };

  // ---------- rename and add ----------
  function startRename(id: string) {
    const item = rows.find((r) => r.id === id);
    if (!item) return;
    closeInputs();
    setSelectedId(id);
    setRename({ id, text: item.type === 'group' ? item.group.name : item.category.name, error: '' });
  }

  function commitRename(cancelOnError: boolean) {
    if (!rename) return;
    const error = nameError(tree, rename.text, rename.id);
    if (error) {
      setRename(cancelOnError ? null : { ...rename, error });
      return;
    }
    changeTree(renameItem(tree, rename.id, rename.text.trim()));
    setRename(null);
    focusList();
  }

  function startAdding(next: Adding) {
    closeInputs();
    setAdding(next);
  }

  function commitAdd() {
    if (!adding) return;
    if (!adding.text.trim()) {
      setAdding(null);
      focusList();
      return;
    }
    const error = nameError(tree, adding.text, null);
    if (error) {
      setAdding({ ...adding, error });
      return;
    }
    const name = adding.text.trim();
    if (adding.type === 'category') {
      const id = newCategoryId();
      changeTree(addCategory(tree, adding.groupId, { id, name }));
      setSelectedId(id);
      // stay in the input to add the next category quickly
      setAdding({ ...adding, text: '' });
    } else {
      const id = newCategoryGroupId();
      changeTree(addGroup(tree, { id, name, kind: adding.kind, categories: [] }));
      setSelectedId(id);
      // a new group goes straight on to its first category
      setAdding({ type: 'category', groupId: id, text: '', error: '' });
    }
  }

  // ---------- delete, move, reorder, kind ----------
  function remove(id: string) {
    const group = tree.find((g) => g.id === id);
    if (group) {
      if (group.categories.length) {
        showToast(`Move or delete the categories in “${group.name}” first`, { warn: true });
        return;
      }
      changeTree(removeGroup(tree, id));
      setSelectedId(neighbourOf(id));
      focusList();
      return;
    }
    const found = findCategory(tree, id);
    if (!found) return;
    const count = countFor(found.category.id);
    if (!count) {
      deleteCategory(found.category.id, null);
      return;
    }
    // its transactions need a new category: pick one, starting in the same group
    const options = groupsInOrder(tree).flatMap((g) =>
      g.categories.filter((c) => c.id !== id).map((c) => ({ value: c.id, label: c.name, hint: g.name })),
    );
    closeInputs();
    setSelectedId(id);
    setPicker({
      mode: 'delete',
      id: found.category.id,
      title: `Delete “${found.category.name}” and move its ${plural(count, 'transaction')} to`,
      options,
      initial: Math.max(
        0,
        options.findIndex((o) => o.hint === found.group.name),
      ),
    });
  }

  /** Deletes a category; its transactions go to `toId`, or become uncategorized. */
  function deleteCategory(id: CategoryId, toId: CategoryId | null) {
    // transactions already headed for this category follow it to its replacement
    let nextMoves = moves.map((m) => (m.toId === id && toId ? { ...m, toId } : m)).filter((m) => m.toId !== id);
    const own = savedCounts.get(id) || 0;
    if (toId && own) nextMoves = [...nextMoves, { fromId: id, toId, count: own }];
    setSelectedId(neighbourOf(id));
    changeTree(removeCategory(tree, id), nextMoves);
    setPicker(null);
    focusList();
  }

  function startMove(id: CategoryId) {
    const found = findCategory(tree, id);
    if (!found) return;
    const options = groupsInOrder(tree).map((g) => ({
      value: g.id,
      label: g.name,
      hint: g.id === found.group.id ? 'current' : KIND_LABELS[g.kind],
    }));
    closeInputs();
    setSelectedId(id);
    setPicker({
      mode: 'move',
      id,
      title: `Move “${found.category.name}” to group`,
      options,
      initial: options.findIndex((o) => o.value === found.group.id),
    });
  }

  function startKind(group: EditableGroup) {
    const options = KINDS.map((k) => ({ value: k, label: KIND_LABELS[k], hint: k === group.kind ? 'current' : '' }));
    closeInputs();
    setSelectedId(group.id);
    setPicker({
      mode: 'kind',
      id: group.id,
      title: `Type of “${group.name}”`,
      options,
      initial: KINDS.indexOf(group.kind),
    });
  }

  function confirmPicker(option: PickerOption) {
    if (!picker) return;
    if (picker.mode === 'delete') {
      deleteCategory(picker.id as CategoryId, option.value as CategoryId);
      return;
    }
    if (picker.mode === 'kind') {
      setPicker(null);
      setKind(picker.id as CategoryGroupId, option.value as CategoryKind);
      focusList();
      return;
    }
    changeTree(moveCategory(tree, picker.id, option.value));
    setPicker(null);
    focusList();
  }

  function setKind(id: CategoryGroupId, kind: CategoryKind) {
    if (tree.find((g) => g.id === id)?.kind === kind) return;
    changeTree(setGroupKind(tree, id, kind));
    setSelectedId(id);
    focusList();
  }

  // ---------- save / discard ----------
  const changes = useMemo(() => describeChanges(saved, tree, moves), [saved, tree, moves]);

  async function save() {
    if (!changes.length) return;
    closeInputs();
    // the reloaded tree becomes the new starting point
    edited.current = false;
    await saveCategories(toSaveRequest(tree, moves));
    showToast('Categories saved');
    focusList();
  }

  function discard() {
    edited.current = false;
    setTree(saved);
    setMoves([]);
    closeInputs();
    if (!treeHas(saved, selectedId)) setSelectedId(saved[0]?.id ?? null);
    showToast('Changes discarded');
    focusList();
  }

  // ⌘S saves from anywhere on the page; an open name field is finished first (its blur keeps a valid name).
  // The save runs after the blur's change has been drawn, so it has to be the `save` of that later render: the
  // ref holds it, as the key handler itself only sees this render's.
  const saveRef = useRef(save);
  saveRef.current = save;
  useWindowKeyDown(
    (e) => {
      if (!isMod(e) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
      setTimeout(() => void saveRef.current());
    },
    { capture: true },
  );

  // ---------- keys ----------
  function onTreeKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== listRef.current || !row) return;
    const k = e.key;
    if (e.altKey && (k === 'ArrowUp' || k === 'ArrowDown')) {
      e.preventDefault();
      changeTree(reorder(tree, row.id, k === 'ArrowUp' ? -1 : 1));
      return;
    }
    if (repeatGuard.blocks(e)) {
      e.preventDefault();
      return;
    }
    let to = rowMove(e, rowIndex, rows.length, true);
    if (to == null && !isMod(e) && !e.altKey) {
      // ← from a category goes to its group, → from a group to its first category
      if (k === 'ArrowLeft' && row.type === 'category') to = rows.findIndex((r) => r.id === row.group.id);
      else if (k === 'ArrowRight' && row.type === 'group' && row.group.categories.length) to = rowIndex + 1;
      else if (k === 'Enter' || k === 'F2') startRename(row.id);
      else if (k === 'n' || k === 'N') startAdding({ type: 'category', groupId: row.group.id, text: '', error: '' });
      else if (k === 'g' || k === 'G') startAdding({ type: 'group', kind: row.group.kind, text: '', error: '' });
      else if ((k === 'm' || k === 'M') && row.type === 'category') startMove(row.category.id);
      else if (k === 'k' || k === 'K') startKind(row.group);
      else if (k === 'Delete' || k === 'Backspace') remove(row.id);
      else return;
    }
    e.preventDefault();
    if (to == null) return;
    setSelectedId(rows[to].id);
    repeatGuard.moved();
  }

  const onRowMouseDown = (e: MouseEvent, id: string) => {
    const target = e.target as HTMLElement;
    if (['INPUT', 'SELECT', 'OPTION'].includes(target.tagName)) return;
    // buttons keep their click; anywhere else selects without taking focus from the tree
    if (!target.closest('button')) e.preventDefault();
    setSelectedId(id);
    focusList();
  };

  // ---------- rendering ----------
  const nameCell = (id: string, name: string, label: string) =>
    rename?.id === id ? (
      <NameField
        label={label}
        text={rename.text}
        error={rename.error}
        onText={(text) => setRename({ ...rename, text, error: '' })}
        onDone={() => commitRename(false)}
        onCancel={() => {
          setRename(null);
          focusList();
        }}
        onBlur={() => commitRename(true)}
      />
    ) : (
      <span className={s.name}>{name}</span>
    );

  const addRow = (label: string, title: string, forGroup: boolean) =>
    adding && (
      <>
        <div className={cx(s.addrow, forGroup && s.forgroup)}>
          <NameField
            label={label}
            placeholder={title}
            text={adding.text}
            error={adding.error}
            onText={(text) => setAdding({ ...adding, text, error: '' })}
            onDone={commitAdd}
            onCancel={() => {
              setAdding(null);
              focusList();
            }}
            onBlur={() => {
              if (!adding.text.trim() || nameError(tree, adding.text, null)) setAdding(null);
              else commitAdd();
            }}
          />
        </div>
        <FieldError error={adding.error} />
      </>
    );

  const errorFor = (id: string) => rename?.id === id && <FieldError error={rename.error} />;

  const savedCategories = new Map(
    saved.flatMap((group) => group.categories.map((category) => [category.id, { category, group }] as const)),
  );
  const savedGroups = new Map(saved.map((g) => [g.id, g]));

  const pickerUnder = (id: string) =>
    picker?.id === id && (
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
    );

  function renderGroup(group: EditableGroup) {
    const before = savedGroups.get(group.id);
    const tag = !before ? 'New' : before.name !== group.name || before.kind !== group.kind ? 'Edited' : '';
    const addingHere = adding?.type === 'category' && adding.groupId === group.id;
    return (
      <div key={group.id}>
        <div
          className={cx(s.grow, selectedId === group.id && s.sel)}
          id={`r-${group.id}`}
          role="treeitem"
          aria-level={1}
          aria-expanded="true"
          aria-selected={selectedId === group.id}
          onMouseDown={(e) => onRowMouseDown(e, group.id)}
          onDoubleClick={() => startRename(group.id)}
        >
          {nameCell(group.id, group.name, 'Group name')}
          {tag && <span className={s.tag}>{tag}</span>}
          <span className={s.spacer} />
          <span className={s.acts}>
            <IconButton
              icon="plus"
              label={`Add category to ${group.name}`}
              title="Add category (N)"
              onClick={() => startAdding({ type: 'category', groupId: group.id, text: '', error: '' })}
            />
            <IconButton
              icon="pen"
              label={`Rename ${group.name}`}
              title="Rename (Enter)"
              onClick={() => startRename(group.id)}
            />
            <IconButton
              icon="bin"
              label={`Delete ${group.name}`}
              title="Delete (Del)"
              onClick={() => remove(group.id)}
              danger
            />
          </span>
          <select
            className={s.kindsel}
            aria-label={`Type of ${group.name}`}
            title="Type (K)"
            value={group.kind}
            onChange={(e) => setKind(group.id, e.target.value as CategoryKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        {errorFor(group.id)}
        {pickerUnder(group.id)}
        {group.categories.map((category) => renderCategory(group, category))}
        {!group.categories.length && !addingHere && <div className={s.emptyrow}>No categories yet</div>}
        {addingHere && addRow(`New category name in ${group.name}`, 'New category', false)}
      </div>
    );
  }

  function renderCategory(group: EditableGroup, category: EditableCategory) {
    const before = savedCategories.get(category.id);
    const tag = !before
      ? 'New'
      : before.category.name !== category.name || before.group.id !== group.id
        ? 'Edited'
        : '';
    return (
      <div key={category.id}>
        <div
          className={cx(s.crow, selectedId === category.id && s.sel)}
          id={`r-${category.id}`}
          role="treeitem"
          aria-level={2}
          aria-selected={selectedId === category.id}
          onMouseDown={(e) => onRowMouseDown(e, category.id)}
          onDoubleClick={() => startRename(category.id)}
        >
          {nameCell(category.id, category.name, 'Category name')}
          {tag && <span className={s.tag}>{tag}</span>}
          <span className={s.spacer} />
          <span className={s.acts}>
            <IconButton
              icon="pen"
              label={`Rename ${category.name}`}
              title="Rename (Enter)"
              onClick={() => startRename(category.id)}
            />
            <IconButton
              icon="move"
              label={`Move ${category.name} to another group`}
              title="Move to group (M)"
              onClick={() => startMove(category.id)}
            />
            <IconButton
              icon="bin"
              label={`Delete ${category.name}`}
              title="Delete (Del)"
              onClick={() => remove(category.id)}
              danger
            />
          </span>
        </div>
        {errorFor(category.id)}
        {pickerUnder(category.id)}
      </div>
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
              onClick={() => startAdding({ type: 'group', kind: row?.group.kind ?? 'expense', text: '', error: '' })}
              title="New group (G)"
            >
              New group
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => row && startAdding({ type: 'category', groupId: row.group.id, text: '', error: '' })}
              title="New category in the selected group (N)"
            >
              New category
            </button>
          </div>
        </div>

        <div className={s.body}>
          <div className={cx(s.card, s.main)}>
            <div
              className={s.tree}
              role="tree"
              aria-label="Category groups and categories"
              aria-activedescendant={selectedId ? `r-${selectedId}` : undefined}
              tabIndex={0}
              onKeyDown={onTreeKey}
              ref={listRef}
            >
              {KINDS.map((kind) => {
                const kindGroups = tree.filter((g) => g.kind === kind);
                return (
                  <div key={kind}>
                    <div className={s.sechead} role="presentation">
                      {SECTION_TITLES[kind]} <span className={s.seccount}>{plural(kindGroups.length, 'group')}</span>
                    </div>
                    {kindGroups.map(renderGroup)}
                    {adding?.type === 'group' && adding.kind === kind && addRow('New group name', 'New group', true)}
                  </div>
                );
              })}
            </div>
          </div>

          <aside className={s.side}>
            <ChangesCard changes={changes} onSave={() => void save()} onDiscard={discard} />
            <AccountsCard />
          </aside>
        </div>
      </main>
    </>
  );
}
