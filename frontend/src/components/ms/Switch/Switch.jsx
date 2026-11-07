import { forwardRef, useId } from 'react';
import { cx } from '../cx.js';
import styles from './Switch.module.css';

/**
 * Přepínač zapnuto/vypnuto (TkZadavaniCasu „Automatický zápis“): nativní
 * checkbox s role="switch" přes celou dotykovou plochu 52 × 44 a viditelný
 * popisek. onChange dostává e.target.checked beze změny.
 */
const Switch = forwardRef(function Switch({ label, description, id: idProp, className, ...rest }, ref) {
  const autoId = useId();
  const id = idProp ?? `s${autoId}`;
  const descriptionId = description ? `${id}-popis` : undefined;
  return (
    <div className={cx(styles.switch, className)}>
      <span className={styles.control}>
        <input ref={ref} id={id} type="checkbox" role="switch" className={styles.input} aria-describedby={descriptionId} {...rest} />
        <span className={styles.track} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
      </span>
      <span className={styles.text}>
        <label htmlFor={id} className={styles.label}>{label}</label>
        {description && <span id={descriptionId} className={styles.description}>{description}</span>}
      </span>
    </div>
  );
});

export default Switch;
