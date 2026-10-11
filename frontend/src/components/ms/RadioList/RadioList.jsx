import { useId } from 'react';
import { cx } from '../cx.js';
import styles from './RadioList.module.css';

/**
 * Výběr jedné možnosti ze svislého seznamu karet s kolečkem, nadpisem
 * a popisem (AdminDialogZverejnitSoubor „Ke které sezóně“). Nativní rádia
 * ve fieldsetu s legendou; vybraná karta má navy rámeček a podklad.
 * options: [{ value, label, description? }]; onChange dostane value volby.
 */
export default function RadioList({ label, name, options, value, onChange, className }) {
  const autoId = useId();
  return (
    <fieldset className={cx(styles.group, className)}>
      <legend className={styles.legend}>{label}</legend>
      {options.map((option) => (
        <label key={option.value} className={styles.option}>
          <input
            type="radio"
            name={name ?? autoId}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className={styles.input}
          />
          <span className={styles.text}>
            <span className={styles.label}>{option.label}</span>
            {option.description && <span className={styles.description}>{option.description}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
