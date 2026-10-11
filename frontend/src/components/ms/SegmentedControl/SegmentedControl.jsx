import { cx } from '../cx.js';
import Icon from '../Icon/Icon.jsx';
import styles from './SegmentedControl.module.css';

/**
 * Výběr jedné volby ze skupiny tlačítek (filtr Vše / Na sněhu / Suché, kolo,
 * DNF/DNS/DSQ). Vybraná volba je plná navy a má aria-pressed="true" – výběr
 * tak nenese jen barva.
 * options: [{ value, label, icon?, disabled? }]
 * allowDeselect: klik na vybranou volbu ji zruší (onChange(null)) – např. DNF.
 */
export default function SegmentedControl({ label, options, value, onChange, allowDeselect = false, size = 'md', className }) {
  return (
    <div role="group" aria-label={label} className={cx(styles.group, className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={option.disabled}
            className={cx(styles.option, styles[size])}
            onClick={() => {
              if (!selected) onChange(option.value);
              else if (allowDeselect) onChange(null);
            }}
          >
            {option.icon && <Icon name={option.icon} size={16} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
