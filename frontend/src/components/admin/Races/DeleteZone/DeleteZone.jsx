import { Button } from '../../../ms/index.js';
import { registrationsWord } from '../raceList.js';
import styles from './DeleteZone.module.css';

/** Nebezpečná zóna pod formulářem úpravy (AdminZavodForm): smazání závodu. */
export default function DeleteZone({ race, onDelete }) {
  const count = race.registrations_count || 0;
  return (
    <section className={styles.zone} aria-labelledby="zavod-smazat">
      <span className={styles.text}>
        <h2 id="zavod-smazat" className={styles.title}>Smazat závod</h2>
        {count > 0 && (
          <span className={styles.desc}>
            Smaže i <span className={styles.mono}>{count}</span> {registrationsWord(count)} a startovní listinu.
          </span>
        )}
      </span>
      <Button variant="danger" size="sm" icon="trash" onClick={onDelete}>Smazat závod</Button>
    </section>
  );
}
