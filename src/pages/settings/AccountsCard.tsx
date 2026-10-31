import { type KeyboardEvent, useMemo, useRef, useState } from 'react';
import { cx } from '../../components/cx';
import { RepeatGuard, rowMove } from '../../keys/keys';
import { countBy } from '../../model/countBy';
import { sameName } from '../../model/names';
import { plural } from '../../model/plural';
import type { Account, AccountId } from '../../model/types';
import { createAccount, removeAccount, renameAccount, showToast, useStore } from '../../store/store';
import { IconButton } from './IconButton';
import { FieldError, NameField } from './NameField';
import s from './settings.module.css';

const NEW = 'new';

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
  // the account being renamed, or NEW for the add row at the end of the list
  const [edit, setEdit] = useState<{ id: AccountId | typeof NEW; text: string; error: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const repeatGuard = useRef(new RepeatGuard()).current;
  const index = Math.min(selected, Math.max(0, sorted.length - 1));
  const focusList = () => listRef.current?.focus({ preventScroll: true });

  // the input blurs as it unmounts; an edit closed by Enter or Esc must not be committed again by that blur
  const closed = useRef<typeof edit>(null);
  const close = () => {
    closed.current = edit;
    setEdit(null);
  };

  const startAdd = () => setEdit({ id: NEW, text: '', error: '' });
  const startRename = (account: Account) => setEdit({ id: account.id, text: account.name, error: '' });

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
    if (edit.id === NEW && !name) {
      close();
      focusList();
      return;
    }
    const clash = sorted.find((a) => a.id !== edit.id && sameName(a.name, name));
    const error = !name ? 'Enter a name' : clash ? `“${clash.name}” already exists` : '';
    if (error) {
      if (cancelOnError) close();
      else setEdit({ ...edit, error });
      return;
    }
    close();
    if (edit.id === NEW) {
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
    const next = rowMove(e, index, sorted.length, true);
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
        placeholder={edit.id === NEW ? 'New account' : undefined}
        text={edit.text}
        error={edit.error}
        onText={(text) => setEdit({ ...edit, text, error: '' })}
        onDone={() => void commit(false)}
        onCancel={cancel}
        onBlur={() => void commit(true)}
      />
    );

  const errorRow = (id: AccountId | typeof NEW) => edit?.id === id && <FieldError error={edit.error} />;

  return (
    <div className={s.card}>
      <div className={s.cardhead}>
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
        className={s.alist}
        role="listbox"
        aria-label="Accounts"
        aria-activedescendant={sorted.length ? `a-${sorted[index].id}` : undefined}
        tabIndex={0}
        onKeyDown={onKey}
        ref={listRef}
      >
        {!sorted.length && edit?.id !== NEW && <p className={s.emptyrow}>No accounts yet</p>}
        {sorted.map((account, i) => {
          const count = countFor(account);
          return (
            <div key={account.id}>
              <div
                className={cx(s.arow, i === index && s.sel)}
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
                {edit?.id === account.id ? (
                  nameInput('Account name')
                ) : (
                  <>
                    <span className={s.name}>{account.name}</span>
                    <span className={s.spacer} />
                    <span className={s.acts}>
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
              {errorRow(account.id)}
            </div>
          );
        })}
        {edit?.id === NEW && (
          <>
            <div className={cx(s.addrow, s.forgroup)}>{nameInput('New account name')}</div>
            {errorRow(NEW)}
          </>
        )}
      </div>
    </div>
  );
}
