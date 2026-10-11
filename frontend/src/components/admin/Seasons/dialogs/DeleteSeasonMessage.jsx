import { seasonCounts, seasonRange } from '../seasons.js';
import styles from './DeleteSeasonMessage.module.css';

/** Tělo AdminDialogSmazatSezonu: karta sezóny a co se stane s dokumenty. */
export default function DeleteSeasonMessage({ season }) {
  return (
    <div className={styles.body}>
      <div className={styles.card}>
        <span className={styles.edition}>{season.edition_label || '—'}</span>
        <span className={styles.text}>
          <span className={styles.label}>{season.season_label}</span>
          <span className={styles.meta}>{seasonRange(season.year_start)} · {seasonCounts(season)}</span>
        </span>
      </div>
      <p className={styles.note}>Dokumenty sezóny se odpojí, soubory zůstanou v knihovně. Sezónu se závody smazat nejde.</p>
    </div>
  );
}
