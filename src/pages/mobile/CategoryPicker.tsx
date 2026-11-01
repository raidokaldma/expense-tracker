import type { CategoryId, Transaction } from '../../../shared/types';
import { sortedTree } from '../../model/lookup';
import { useStore } from '../../store/store';
import { updateTransaction } from '../../store/transactions';
import s from './CategoryPicker.module.css';

const NO_CATEGORY = '';

/** The phone's own picker, listing categories under their groups. */
export function CategoryPicker({ transaction }: { transaction: Transaction }) {
  const groups = useStore((st) => st.groups);
  const categories = useStore((st) => st.categories);

  function change(value: string) {
    const categoryId = value === NO_CATEGORY ? null : (value as CategoryId);
    if (categoryId !== transaction.categoryId) updateTransaction(transaction.id, { categoryId }, 'edit category');
  }

  return (
    <select
      className={s.picker}
      aria-label={`Category of ${transaction.counterparty || 'transaction'}`}
      value={transaction.categoryId ?? NO_CATEGORY}
      onChange={(e) => change(e.target.value)}
    >
      <option value={NO_CATEGORY}>No category</option>
      {sortedTree(groups, categories).map(({ group, categories: inGroup }) => (
        <optgroup key={group.id} label={group.name}>
          {inGroup.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
