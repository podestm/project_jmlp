import { useId } from 'react';
import { cx } from '../../ms/cx.js';
import styles from './CategoryChips.module.css';

/**
 * Výběr kategorie (TkZadavaniCasu, TkVysledky): verzálkový popisek a řada
 * tlačítek „název počet“. Vybraná je plná navy a má aria-pressed – výběr
 * nenese jen barva.
 *
 * @param {Array<{value: string, label: string, count: number}>} options
 * @param {string} value
 * @param {(value: string) => void} onChange
 * @param {'sm'|'md'} [size] sm v zadávání časů (36 px), md ve výsledcích (48 px)
 */
export default function CategoryChips({ options, value, onChange, size = 'md', className }) {
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
            className={cx(styles.chip, styles[size])}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            <span className={styles.count}>{option.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
