import { Icon, Spinner } from '../../../ms/index.js';
import styles from './RacerMatches.module.css';

const SHOWN = 20;

// Starší záznamy mají místo prázdného SLČR ID pomlčku.
const hasSlcr = (racer) => Boolean(racer.slcr_id) && racer.slcr_id !== '-';

/**
 * Závodníci z databáze, kteří odpovídají jménu, příjmení nebo SLČR ID ve
 * formuláři (PrihlaskaHledani). Klik formulář vyplní (useRegistration);
 * telefon a e-mail se záměrně nepřebírají.
 */
export default function RacerMatches({ racers, isSearching, hasQuery, onSelect, getSexLabel }) {
  let content;
  if (isSearching) {
    content = <p className={styles.state}><Spinner size={18} /> Hledám závodníky…</p>;
  } else if (racers.length === 0) {
    content = (
      <p className={styles.state}>
        <Icon name={hasQuery ? 'search-x' : 'search'} size={18} />
        {hasQuery
          ? 'V databázi jsme nikoho takového nenašli – vyplňte údaje ručně.'
          : 'Začněte psát jméno nebo příjmení – kdo už v JMLP jel, toho vám nabídneme k vyplnění.'}
      </p>
    );
  } else {
    content = (
      <>
        <ul className={styles.list}>
          {racers.slice(0, SHOWN).map((racer) => (
            <li key={racer.id}>
              <button type="button" className={styles.racer} onClick={() => onSelect(racer)}>
                <span className={styles.text}>
                  <span className={styles.name}>{racer.surname} {racer.name}</span>
                  <span className={styles.meta}>
                    {[racer.year, getSexLabel(racer.sex), racer.club_name, hasSlcr(racer) && `SLČR ${racer.slcr_id}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={styles.fill}>Vyplnit <Icon name="arrow-right" size={16} /></span>
              </button>
            </li>
          ))}
        </ul>
        {racers.length > SHOWN && <p className={styles.more}>… a dalších {racers.length - SHOWN} závodníků. Upřesněte jméno.</p>}
      </>
    );
  }

  return (
    <section className={styles.matches} aria-labelledby="uz-jel" aria-live="polite">
      <h3 id="uz-jel" className={styles.title}>Závodník už v JMLP jel?</h3>
      {content}
    </section>
  );
}
