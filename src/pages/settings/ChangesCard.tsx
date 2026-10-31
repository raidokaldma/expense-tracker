import { cx } from '../../components/cx';
import { MOD_LABEL } from '../../keys/keys';
import s from './settings.module.css';

/** The unsaved category changes in words, with Save and Discard. */
export function ChangesCard({
  changes,
  onSave,
  onDiscard,
}: {
  changes: string[];
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className={s.card}>
      <h2>
        Unsaved changes <span className={cx(s.badge, !changes.length && s.zero)}>{changes.length}</span>
      </h2>
      {changes.length ? (
        <ul className={s.changes}>
          {changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      ) : (
        <p className={s.muted}>Everything is saved.</p>
      )}
      <div className={s.buttons}>
        <button
          type="button"
          className="btn primary"
          disabled={!changes.length}
          onClick={onSave}
          title={`Save (${MOD_LABEL}S)`}
        >
          Save changes
        </button>
        <button type="button" className="btn" disabled={!changes.length} onClick={onDiscard}>
          Discard
        </button>
      </div>
    </div>
  );
}
