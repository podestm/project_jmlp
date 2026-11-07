import { cx } from '../cx.js';
import Icon from '../Icon/Icon.jsx';
import styles from './SegmentedControl.module.css';

/**
 * Výběr jedné volby ze skupiny tlačítek (filtr Vše / Na sněhu / Suché, kolo,
 * DNF/DNS/DSQ). Vybraná volba je plná navy a má aria-pressed="true" – výběr
 * tak nenese jen barva.
 * options: [{ value, label, shortLabel?, icon?, disabled? }] – shortLabel se ukáže
 *   pod 768 px místo label (přístupné jméno zůstává label)
 * allowDeselect: klik na vybranou volbu ji zruší (onChange(null)) – např. DNF.
 * fill: pod 768 px volby vyplní řádek stejnými díly (MobilZavody).
 */
export default function SegmentedControl({ label, options, value, onChange, allowDeselect = false, size = 'md', fill = false, className }) {
  return (
    <div role="group" aria-label={label} className={cx(styles.group, fill && styles.fill, className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={option.shortLabel ? option.label : undefined}
            disabled={option.disabled}
            className={cx(styles.option, styles[size])}
            onClick={() => {
              if (!selected) onChange(option.value);
              else if (allowDeselect) onChange(null);
            }}
          >
            {option.icon && <Icon name={option.icon} size={16} />}
            {option.shortLabel ? (
              <>
                <span className={styles.long}>{option.label}</span>
                <span className={styles.short}>{option.shortLabel}</span>
              </>
            ) : option.label}
          </button>
        );
      })}
    </div>
  );
}
