import { cx } from '../../../../ms/cx.js';
import { STATUS_TABS } from '../slcrPairing.js';
import styles from './StatusTabs.module.css';

/** Záložky stavu párování s počty; vybraná má aria-current a podtržení. */
export default function StatusTabs({ status, counts, onChange }) {
  return (
    <div role="group" aria-label="Stav párování" className={styles.tabs}>
      {STATUS_TABS.map((tab) => {
        const active = status === tab.status;
        return (
          <button
            key={tab.status}
            type="button"
            aria-current={active || undefined}
            className={cx(styles.tab, active && styles.active)}
            onClick={() => onChange(tab.status)}
          >
            {tab.label}
            <span className={styles.count}>{counts[tab.status] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
