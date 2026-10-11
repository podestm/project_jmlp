import { Link } from 'react-router-dom';
import { Icon } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import { czechDateParts } from '../../../ms/BibDate/czechDate.js';
import { formatDateShort } from '../../../../utils/date.js';
import styles from './RaceSwitcher.module.css';

/**
 * „Měříme závod“ v horní liště: vybraný závod a odkaz do Přehledu, kde se
 * závod přepíná (jinde se přepnout nedá).
 * - layout bar: rámeček s „Přepnout“ (desktop), plain: jen text (mobilní hlavička a menu)
 */
export default function RaceSwitcher({ race, layout = 'bar', className }) {
  const info = race ? (
    <>
      <span className={styles.name}>{race.areal_name || `Závod ${race.race_nr || race.id}`}</span>
      {race.datum && (
        <span className={styles.date}>
          <span className={styles.weekday}>{czechDateParts(race.datum).weekdayShort}</span>
          <span className={styles.mono}>{formatDateShort(race.datum)}</span>
        </span>
      )}
    </>
  ) : (
    <span className={styles.name}>Závod není vybraný</span>
  );

  if (layout !== 'bar') {
    return (
      <span className={cx(styles.plain, styles[layout], className)}>
        <span className={styles.caps}>{layout === 'compact' ? 'Časomíra · měříme závod' : 'Měříme závod'}</span>
        {info}
      </span>
    );
  }

  return (
    <Link to="/timekeeper" className={cx(styles.switcher, className)}>
      <Icon name="tag" size={20} strokeWidth={1.9} className={styles.tag} />
      <span className={styles.text}>
        <span className={styles.caps}>Měříme závod</span>
        <span className={styles.line}>{info}</span>
      </span>
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.action}>
        <span>{race ? 'Přepnout' : 'Vybrat'}</span>
        <Icon name="chevron-down" size={16} strokeWidth={2.4} />
      </span>
    </Link>
  );
}
