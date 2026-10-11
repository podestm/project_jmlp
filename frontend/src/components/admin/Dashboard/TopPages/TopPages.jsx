import { EmptyState, Panel } from '../../../ms/index.js';
import { formatCount, pathLabel } from '../dashboard.js';
import styles from './TopPages.module.css';

/**
 * Nejnavštěvovanější stránky za 30 dní (AdminDashboard): popisek, počet
 * a pruh poměrný k nejnavštěvovanější. Šířka pruhu jde přes custom property.
 */
export default function TopPages({ pages }) {
  if (pages.length === 0) {
    return <EmptyState icon="chart" title="Žádná data" hint="O návštěvnosti se zatím nic nesesbíralo." headingLevel={3} />;
  }
  const max = Math.max(...pages.map((page) => page.visits), 1);
  return (
    <Panel padding="none">
      <ul className={styles.list}>
        {pages.map((page) => (
          <li key={page.path} className={styles.item}>
            <span className={styles.row}>
              <span className={styles.label} title={page.path}>{pathLabel(page.path)}</span>
              <span className={styles.count}>{formatCount(page.visits)}</span>
            </span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.bar} style={{ '--share': `${(page.visits / max) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
