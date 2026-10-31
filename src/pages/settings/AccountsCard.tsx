import { type KeyboardEvent, useMemo, useRef, useState } from 'react';
import { sameName } from '../../../shared/names';
import type { Account, AccountId } from '../../../shared/types';
import { cx } from '../../components/cx';
import { listMove } from '../../keys/keys';
import { useRepeatGuard } from '../../keys/useRepeatGuard';
import { countBy } from '../../model/countBy';
import { plural } from '../../model/plural';
import { createAccount, removeAccount, renameAccount } from '../../store/settings';
import { useStore } from '../../store/store';
import { showToast } from '../../store/toast';
import s from './AccountsCard.module.css';
import card from './card.module.css';
import { IconButton } from './IconButton';
import list from './list.module.css';
import { FieldError, NameField } from './NameField';

/** Adding an account in the row at the end of the list, or renaming one in place. */
type AccountEdit =
  | { mode: 'add'; text: string; error: string }
  | { mode: 'rename'; id: AccountId; text: string; error: string };

/**
 * Accounts: N (or New account) adds one, Enter renames the selected one, Del deletes it when it has no
 * transactions. Imports also create accounts; a name change never affects which account an import lands in.
 */
export function AccountsCard() {
  const accounts = useStore((st) => st.accounts);
  const sorted = useMemo(() => [...accounts].sort((a, b) => a.name.localeCompare(b.name)), [accounts]);
  const transactions = useStore((st) => st.transactions);
  const transactionCounts = useMemo(() => countBy(transactions, (t) => t.accountId), [transactions]);
  const countFor = (account: Account) => transactionCounts.get(account.id) ?? 0;
  const [selected, setSelected] = useState(0);
  const [edit, setEdit] = useState<AccountEdit | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const repeatGuard = useRepeatGuard();
  const index = Math.min(selected, Math.max(0, sorted.length - 1));
  const focusList = () => listRef.current?.focus({ preventScroll: true });

  // the input blurs as it unmounts; an edit closed by Enter or Esc must not be committed again by that blur
  const closed = useRef<typeof edit>(null);
  const close = () => {
    closed.current = edit;
    setEdit(null);
  };

  const startAdd = () => setEdit({ mode: 'add', text: '', error: '' });
  const isRenaming = (id: AccountId) => edit?.mode === 'rename' && edit.id === id;
  const startRename = (account: Account) => setEdit({ mode: 'rename', id: account.id, text: account.name, error: '' });

  function remove(account: Account) {
    const count = countFor(account);
    if (count) {
      showToast(`“${account.name}” has ${plural(count, 'transaction')}; only an empty account can be deleted`, {
        warn: true,
      });
      return;
    }
    removeAccount(account.id);
    showToast(`Deleted account “${account.name}”`);
    focusList();
  }

  async function commit(cancelOnError: boolean) {
    if (!edit || closed.current === edit) return;
    const name = edit.text.trim();
    // leaving an empty add row just closes it
    if (edit.mode === 'add' && !name) {
      close();
      focusList();
      return;
    }
    const clash = sorted.find((a) => (edit.mode === 'add' || a.id !== edit.id) && sameName(a.name, name));
    const error = !name ? 'Enter a name' : clash ? `“${clash.name}” already exists` : '';
    if (error) {
      if (cancelOnError) close();
      else setEdit({ ...edit, error });
      return;
    }
    close();
    if (edit.mode === 'add') {
      const created = await createAccount(name);
      setSelected([...sorted, created].sort((a, b) => a.name.localeCompare(b.name)).indexOf(created));
      showToast(`Added account “${name}”`);
    } else if (name !== sorted.find((a) => a.id === edit.id)?.name) {
      renameAccount(edit.id, name);
      showToast(`Renamed account to “${name}”`);
    }
    focusList();
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== listRef.current) return;
    if (repeatGuard.blocks(e)) {
      e.preventDefault();
      return;
    }
    const next = listMove(e, index, sorted.length);
    if (next != null) {
      e.preventDefault();
      setSelected(next);
      repeatGuard.moved();
    } else if ((e.key === 'Enter' || e.key === 'F2') && sorted.length) {
      e.preventDefault();
      startRename(sorted[index]);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && sorted.length) {
      e.preventDefault();
      remove(sorted[index]);
    } else if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      startAdd();
    }
  }

  const cancel = () => {
    close();
    focusList();
  };

  const nameInput = (label: string) =>
    edit && (
      <NameField
        label={label}
        placeholder={edit.mode === 'add' ? 'New account' : undefined}
        text={edit.text}
        error={edit.error}
        onText={(text) => setEdit({ ...edit, text, error: '' })}
        onDone={() => void commit(false)}
        onCancel={cancel}
        onBlur={() => void commit(true)}
      />
    );

  return (
    <div className={cx(card.card, card.padded)}>
      <div className={s.cardHeader}>
        <h2>Accounts</h2>
        <button
          type="button"
          className="btn sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={startAdd}
          title="New account (N)"
        >
          New account
        </button>
      </div>
      <div
        className={list.accountList}
        role="listbox"
        aria-label="Accounts"
        aria-activedescendant={sorted.length ? `a-${sorted[index].id}` : undefined}
        tabIndex={0}
        onKeyDown={onKey}
        ref={listRef}
      >
        {!sorted.length && edit?.mode !== 'add' && <p className={list.emptyRow}>No accounts yet</p>}
        {sorted.map((account, i) => {
          const count = countFor(account);
          return (
            <div key={account.id}>
              <div
                className={cx(list.accountRow, i === index && list.selected)}
                id={`a-${account.id}`}
                role="option"
                aria-selected={i === index}
                onMouseDown={(e) => {
                  if ((e.target as HTMLElement).tagName === 'INPUT') return;
                  e.preventDefault();
                  setSelected(i);
                  focusList();
                }}
                onDoubleClick={() => startRename(account)}
              >
                {isRenaming(account.id) ? (
                  nameInput('Account name')
                ) : (
                  <>
                    <span className={list.name}>{account.name}</span>
                    <span className={list.spacer} />
                    <span className={list.rowActions}>
                      <IconButton
                        icon="pen"
                        label={`Rename ${account.name}`}
                        title="Rename (Enter)"
                        onClick={() => startRename(account)}
                      />
                      <IconButton
                        icon="bin"
                        label={`Delete ${account.name}`}
                        title={count ? `Has ${plural(count, 'transaction')}, so it cannot be deleted` : 'Delete (Del)'}
                        disabled={count > 0}
                        onClick={() => remove(account)}
                        danger
                      />
                    </span>
                  </>
                )}
              </div>
              {edit && isRenaming(account.id) && <FieldError error={edit.error} />}
            </div>
          );
        })}
        {edit?.mode === 'add' && (
          <>
            <div className={cx(list.addRow, list.forGroup)}>{nameInput('New account name')}</div>
            <FieldError error={edit.error} />
          </>
        )}
      </div>
    </div>
  );
}
