import { cx } from '../../../ms/cx.js';
import styles from './SlotCard.module.css';

/**
 * Karta místa pro dokument (AdminPrilohy): název role verzálkami navy,
 * pod ním nápověda, vpravo volitelná akce (`action`), pod tím obsah.
 * wide: v mřížce slotů přes celý řádek (seznam dokumentů).
 */
export default function SlotCard({ label, hint, action, wide = false, children }) {
  return (
    <section className={cx(styles.card, wide && styles.wide)} aria-label={label}>
      <div className={styles.head}>
        <span className={styles.heading}>
          <h3 className={styles.label}>{label}</h3>
          {hint && <span className={styles.hint}>{hint}</span>}
        </span>
        {action && <span className={styles.action}>{action}</span>}
      </div>
      {children}
    </section>
  );
}
