import { useId } from 'react';
import { cx } from '../cx.js';
import Icon from '../Icon/Icon.jsx';
import styles from './RadioTiles.module.css';

/**
 * Výběr jedné možnosti jako dlaždice s kolečkem (ZavodDetail „Pohlaví“):
 * nativní rádia ve fieldsetu s legendou, dlaždice 52 px, vybraná plná navy.
 * Chyba se vykreslí pod skupinou a skupina dostane aria-invalid.
 * options: [{ value, label }]; onChange dostane value vybrané volby.
 */
export default function RadioTiles({ label, name, options, value, onChange, error, required = false, className }) {
  const autoId = useId();
  const errorId = error ? `${autoId}-chyba` : undefined;
  return (
    <fieldset className={cx(styles.group, className)} aria-describedby={errorId} aria-invalid={error ? true : undefined}>
      <legend className={styles.legend}>
        {label}
        {required && <span className={styles.required} aria-hidden="true"> *</span>}
      </legend>
      <div className={styles.tiles}>
        {options.map((option) => (
          <label key={option.value} className={styles.tile} data-invalid={error ? true : undefined}>
            <input
              type="radio"
              name={name ?? autoId}
              value={option.value}
              checked={value === option.value}
              required={required}
              onChange={() => onChange(option.value)}
              className={styles.input}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <span id={errorId} className={styles.error}>
          <Icon name="error" size={18} />
          <span>{error}</span>
        </span>
      )}
    </fieldset>
  );
}
