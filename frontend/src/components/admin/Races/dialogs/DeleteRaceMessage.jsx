import { Icon } from '../../../ms/index.js';
import RaceInfo from '../../shared/RaceInfo/RaceInfo.jsx';
import { raceSubtitle } from '../../shared/raceText.js';
import { registrationsWord } from '../raceList.js';
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
      <RaceInfo
        race={race}
        meta={`${raceSubtitle(race)} · registrace ${race.registration ? 'otevřená' : 'uzavřená'}`}
        aside={(
          <>
            <span className={styles.number}>{count}</span>
            <span className={styles.caps}>{registrationsWord(count)}</span>
          </>
        )}
      />

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
