import { BibDate } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import styles from './RaceInfo.module.css';

/**
 * Karta závodu: datum jako startovní číslo, místo a řádek s popisem,
 * vpravo `aside` (počet přihlášek, stav registrace). Lišta vlevo je zelená
 * při otevřené registraci – stav musí `meta` nebo `aside` říct i textem.
 * - size sm: vsazená do dialogu (AdminDialogSmazatZavod)
 * - size lg: samostatný panel stránky (AdminPrihlasky)
 */
export default function RaceInfo({ race, meta, aside, size = 'sm', className }) {
  return (
    <div className={cx(styles.card, styles[size], className)} data-open={race.registration || undefined}>
      {race.datum && <BibDate date={race.datum} variant="table" />}
      <span className={styles.text}>
        <span className={styles.name}>{race.areal_name || race.race_nr}</span>
        {meta && <span className={styles.meta}>{meta}</span>}
      </span>
      {aside && <span className={styles.aside}>{aside}</span>}
    </div>
  );
}
