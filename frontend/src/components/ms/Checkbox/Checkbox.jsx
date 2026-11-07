import { forwardRef, useId } from 'react';
import { cx } from '../cx.js';
import styles from './Checkbox.module.css';

/**
 * Zaškrtávací pole s viditelným popiskem (cíl 44 px). Nativní input, takže
 * onChange dostává e.target.checked jako dosud.
 */
const Checkbox = forwardRef(function Checkbox({ label, description, id: idProp, className, ...rest }, ref) {
  const autoId = useId();
  const id = idProp ?? `c${autoId}`;
  const descriptionId = description ? `${id}-popis` : undefined;
  return (
    <div className={cx(styles.checkbox, className)}>
      <input ref={ref} id={id} type="checkbox" className={styles.input} aria-describedby={descriptionId} {...rest} />
      <span className={styles.text}>
        <label htmlFor={id} className={styles.label}>{label}</label>
        {description && <span id={descriptionId} className={styles.description}>{description}</span>}
      </span>
    </div>
  );
});

export default Checkbox;
