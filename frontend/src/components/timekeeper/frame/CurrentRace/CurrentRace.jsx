import { Link } from 'react-router-dom';
import { Icon } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import { czechDateParts } from '../../../ms/BibDate/czechDate.js';
import { formatDateShort } from '../../../../utils/date.js';
import styles from './CurrentRace.module.css';

/**
 * „Měříme závod“ v horní liště. Na jednom zařízení se měří vždy jen jeden
 * závod, takže vybraný závod je jen popisek; jiný závod se otevírá z Přehledu.
 * Bez vybraného závodu je rámeček odkazem do Přehledu („Vybrat“).
 */
export default function CurrentRace({ race, className }) {
  if (!race) {
    return (
      <Link to="/timekeeper" className={cx(styles.box, styles.link, className)}>
        <Icon name="tag" size={20} strokeWidth={1.9} className={styles.tag} />
        <span className={styles.text}>
          <span className={styles.caps}>Měříme závod</span>
          <span className={styles.name}>Závod není vybraný</span>
        </span>
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.action}>
          <span>Vybrat</span>
          <Icon name="chevron-down" size={16} strokeWidth={2.4} />
        </span>
      </Link>
    );
  }

  return (
    <div className={cx(styles.box, className)}>
      <Icon name="tag" size={20} strokeWidth={1.9} className={styles.tag} />
      <span className={styles.text}>
        <span className={styles.caps}>Měříme závod</span>
        <span className={styles.line}>
          <span className={styles.name}>
            {race.areal_name || `Závod ${race.race_nr || race.id}`}
          </span>
          {race.datum && (
            <span className={styles.date}>
              <span className={styles.weekday}>{czechDateParts(race.datum).weekdayShort}</span>
              <span className={styles.mono}>{formatDateShort(race.datum)}</span>
            </span>
          )}
        </span>
      </span>
    </div>
  );
}
