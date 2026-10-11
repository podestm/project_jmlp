import { BibDate, Icon } from '../../../ms/index.js';
import { raceSubtitle, registrationsWord } from '../raceList.js';
import styles from './DeleteRaceMessage.module.css';

/**
 * Tělo dialogu AdminDialogSmazatZavod: karta závodu s počtem přihlášek
 * a výčet toho, co se závodem zmizí (backend maže přihlášky i startovní
 * listinu, přílohy jen odpojí).
 */
export default function DeleteRaceMessage({ race }) {
  const count = race.registrations_count || 0;
  const hasDocuments = Boolean(race.proposition_file_id || race.results_file_id);

  return (
    <div className={styles.body}>
      <div className={styles.card} data-open={race.registration || undefined}>
        {race.datum && <BibDate date={race.datum} variant="table" />}
        <span className={styles.text}>
          <span className={styles.name}>{race.areal_name || race.race_nr}</span>
          <span className={styles.meta}>
            {raceSubtitle(race)} · registrace {race.registration ? 'otevřená' : 'uzavřená'}
          </span>
        </span>
        <span className={styles.count}>
          <span className={styles.number}>{count}</span>
          <span className={styles.caps}>{registrationsWord(count)}</span>
        </span>
      </div>

      <p className={styles.caps}>Se závodem zmizí</p>
      <ul className={styles.list}>
        {count > 0 && (
          <li><Icon name="trash" size={18} className={styles.danger} />Smaže se všech {count} {registrationsWord(count)} i startovní listina. Rodiče by je museli podat znovu.</li>
        )}
        <li><Icon name="globe" size={18} />Závod zmizí z kalendáře na webu i s registračním formulářem.</li>
        {hasDocuments && (
          <li><Icon name="unlink" size={18} />Dokumenty závodu se jen odpojí – v knihovně dokumentů zůstanou.</li>
        )}
      </ul>

      {count > 0 && race.registration && (
        <p className={styles.note}>
          <Icon name="info" size={18} />
          <span>Chcete jen zastavit přihlašování? Stačí v seznamu nebo ve formuláři vypnout <strong>registraci</strong> – přihlášky zůstanou.</span>
        </p>
      )}

      <p className={styles.warning}><Icon name="warning" size={18} />Smazání nejde vrátit.</p>
    </div>
  );
}
