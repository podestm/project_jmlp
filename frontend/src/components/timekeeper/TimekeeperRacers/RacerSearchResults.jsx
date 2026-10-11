import { Icon, Spinner } from '../../ms/index.js';
import { getSexLabel } from './racers.js';
import styles from './RacerSearchResults.module.css';

const MAX_SHOWN = 20;

/**
 * Nalezení závodníci z databáze (hledá se podle jména, příjmení nebo SLČR
 * ID ve formuláři). Výběr doplní formulář – zápis do registrací nevzniká.
 */
export default function RacerSearchResults({ racers, isSearching, hasQuery = false, onSelect }) {
  if (isSearching) {
    return (
      <p className={styles.state} role="status">
        <Spinner size={18} />
        Hledám…
      </p>
    );
  }
  if (racers.length === 0 && hasQuery) {
    return (
      <p className={styles.state} role="status">
        <Icon name="search" size={18} />
        V databázi nikoho takového nemáme – vyplňte údaje a přidá se jako nový závodník.
      </p>
    );
  }
  if (racers.length === 0) {
    return (
      <p className={styles.state}>
        <Icon name="search" size={18} />
        Začněte psát příjmení nebo jméno – najdeme závodníka v databázi.
      </p>
    );
  }
  return (
    <div className={styles.results}>
      <span className={styles.caps}>Nalezení závodníci</span>
      <ul className={styles.list}>
        {racers.slice(0, MAX_SHOWN).map((racer) => (
          <li key={racer.id}>
            <button type="button" className={styles.racer} onClick={() => onSelect(racer)}>
              <span className={styles.name}>{racer.surname} {racer.name}</span>
              <span className={styles.meta}>
                {racer.year} · {getSexLabel(racer.sex)}
                {racer.club_name && ` · ${racer.club_name}`}
                {racer.slcr_id && ` · SLČR ${racer.slcr_id}`}
              </span>
              <Icon name="chevron-right" size={18} className={styles.chevron} />
            </button>
          </li>
        ))}
      </ul>
      {racers.length > MAX_SHOWN && (
        <p className={styles.more}>… a dalších {racers.length - MAX_SHOWN} závodníků – upřesněte hledání</p>
      )}
    </div>
  );
}
