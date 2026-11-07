import { useId } from 'react';
import { Icon, VisuallyHidden } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import styles from './CategoryChips.module.css';

/**
 * Výběr kategorie (TkZadavaniCasu, TkVysledky): verzálkový popisek a jedna
 * řada nízkých tlačítek „název počet“, stejná na obou obrazovkách. Vybraná je plná navy a má aria-pressed – výběr
 * nenese jen barva.
 *
 * Volitelná značka u čipu (mark) – např. stav v evidenci SLČR: ikona
 * a skrytý text pro čtečku, význam nikdy nenese jen barva.
 *
 * @param {Array<{value: string, label: string, count: number,
 *   mark?: {icon: string, label: string, tone?: 'done'|'pending'}}>} options
 * @param {string} value
 * @param {(value: string) => void} onChange
 */
export default function CategoryChips({ options, value, onChange, className }) {
  const labelId = useId();
  return (
    <div className={cx(styles.row, className)}>
      <span className={styles.caps} id={labelId}>Kategorie</span>
      <div role="group" aria-labelledby={labelId} className={styles.chips}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={String(option.value) === String(value)}
            className={styles.chip}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            <span className={styles.count}>{option.count}</span>
            {option.mark && (
              <span className={cx(styles.mark, styles[option.mark.tone])} title={option.mark.label}>
                <Icon name={option.mark.icon} size={12} />
                <VisuallyHidden>{`, ${option.mark.label}`}</VisuallyHidden>
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
