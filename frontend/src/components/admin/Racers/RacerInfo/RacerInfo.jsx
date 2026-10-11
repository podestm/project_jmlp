import { racerDetails, racerInitials, racerName } from '../racers.js';
import styles from './RacerInfo.module.css';

/** Karta závodníka v dialogu: iniciály v kolečku, jméno a řádek údajů (AdminDialogSmazatZavodnika). */
export default function RacerInfo({ racer }) {
  return (
    <div className={styles.card}>
      <span className={styles.initials} aria-hidden="true">{racerInitials(racer)}</span>
      <span className={styles.text}>
        <span className={styles.name}>{racerName(racer)}</span>
        <span className={styles.meta}>{racerDetails(racer)}</span>
      </span>
    </div>
  );
}
