import { useId } from 'react';
import { Icon } from '../../../../ms/index.js';
import { cx } from '../../../../ms/cx.js';
import styles from './SlcrStep.module.css';

const STATE_LABELS = { current: 'Teď', done: 'Hotovo', todo: 'Potom' };

/**
 * Očíslovaný krok evidence SLČR: číslo (u hotového fajfka), nadpis, stav
 * slovem (nejen barvou) a obsah kroku. Aktuální krok má navy číslo a lištu.
 */
export default function SlcrStep({ number, title, state = 'todo', className, children }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={cx(styles.step, styles[state], className)}>
      <header className={styles.head}>
        <span className={styles.number} aria-hidden="true">
          {state === 'done' ? <Icon name="check" size={18} /> : number}
        </span>
        <h3 id={titleId} className={styles.title}>
          <span className="ms-sr-only">{`Krok ${number}: `}</span>
          {title}
        </h3>
        <span className={styles.state}>{STATE_LABELS[state]}</span>
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
