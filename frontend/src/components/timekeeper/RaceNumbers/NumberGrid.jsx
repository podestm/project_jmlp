import { cx } from '../../ms/cx.js';
import { setColorVar } from '../../../utils/raceNumbers.js';
import { chunkByTen } from './raceNumberSets.js';
import styles from './NumberGrid.module.css';

/**
 * Čísla rozbalené sady po desítkách (TkCisla): tečka a popis nesou stav
 * (aktivní / neaktivní / ukládá se), klik ho přepne. Stav je řečený i ve
 * jménu tlačítka, takže ho přečte i čtečka.
 */
export default function NumberGrid({ numbers, updatingNumberId, onToggle }) {
  return (
    <div className={styles.wrap}>
      <ul className={styles.legend} aria-label="Stav čísla">
        <li>
          <span className={cx(styles.dot, styles.active)} aria-hidden="true" />
          Aktivní
        </li>
        <li>
          <span className={cx(styles.dot, styles.inactive)} aria-hidden="true" />
          Neaktivní
        </li>
        <li>
          <span className={cx(styles.dot, styles.saving)} aria-hidden="true" />
          Ukládá se
        </li>
      </ul>
      <div className={styles.rows}>
        {chunkByTen(numbers).map((row) => (
          <div key={row[0].id} className={styles.row}>
            <span className={styles.rowLabel}>
              {row[0].display_number}–{row[row.length - 1].display_number}
            </span>
            {row.map((n) => {
              const saving = updatingNumberId === n.id;
              const state = saving ? 'ukládá se' : n.is_active ? 'aktivní' : 'neaktivní';
              return (
                <button
                  key={n.id}
                  type="button"
                  className={cx(styles.cell, !n.is_active && styles.off, saving && styles.busy)}
                  style={{ '--set-color': setColorVar(n.set_color) }}
                  aria-pressed={Boolean(n.is_active)}
                  aria-label={`Dres ${n.actual_number}, ${n.display_number} – ${state}`}
                  title={`Číslo dresu ${n.actual_number} | ${n.display_number}`}
                  disabled={saving}
                  onClick={() => onToggle(n.id, !n.is_active)}
                >
                  <span
                    className={cx(
                      styles.dot,
                      saving ? styles.saving : n.is_active ? styles.active : styles.inactive,
                    )}
                    aria-hidden="true"
                  />
                  <span className={styles.number}>{n.actual_number}</span>
                  <span className={styles.system}>{n.display_number}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
