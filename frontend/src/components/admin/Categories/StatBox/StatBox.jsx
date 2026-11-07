import { cx } from '../../../ms/cx.js';
import styles from './StatBox.module.css';

/**
 * Číselná dlaždice souhrnu (AdminKategorie „Stav / Rozsah / Změněno“):
 * popisek verzálkami, hodnota v Plex Mono, pod ní poznámka.
 * - tone: neutral | warning | open – podtrhuje hodnotu, význam nese text
 */
export default function StatBox({ label, value, note, tone = 'neutral' }) {
  return (
    <div className={cx(styles.box, styles[tone])}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {note && <span className={styles.note}>{note}</span>}
    </div>
  );
}
