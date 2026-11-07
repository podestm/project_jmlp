import { Icon } from '../../ms/index.js';
import { SET_COLOR_OPTIONS } from '../../../utils/raceNumbers.js';
import styles from './ColorSwatches.module.css';

/**
 * Výběr barvy sady – skutečné barvy dresů (TkCisla „Barva sady“).
 * Vybraná má fajfku a aria-pressed, jméno barvy nese aria-label.
 */
export default function ColorSwatches({ label, value, onChange }) {
  return (
    <div className={styles.swatches} role="group" aria-label={label}>
      {SET_COLOR_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={selected}
            title={option.label}
            className={styles.swatch}
            style={{ '--swatch': option.solid }}
            onClick={() => onChange(option.value)}
          >
            {selected && <Icon name="check" size={20} strokeWidth={2.6} />}
          </button>
        );
      })}
    </div>
  );
}
