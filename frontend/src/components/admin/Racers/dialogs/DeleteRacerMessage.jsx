import { Icon } from '../../../ms/index.js';
import RacerInfo from '../RacerInfo/RacerInfo.jsx';
import styles from './DeleteRacerMessage.module.css';

/**
 * Tělo dialogu AdminDialogSmazatZavodnika: karta závodníka, co se stane
 * a že to nejde vrátit. Počet přihlášek seznam závodníků nezná – server
 * závodníka s přihláškami odmítne smazat a řekne to hláškou nad seznamem.
 */
export default function DeleteRacerMessage({ racer }) {
  return (
    <div className={styles.body}>
      <RacerInfo racer={racer} />
      <p className={styles.text}>
        Záznam zmizí z databáze závodníků natrvalo. Závodníka, který má přihlášky na závody, server nesmaže.
      </p>
      <p className={styles.warning}><Icon name="warning" size={18} />Smazání nejde vrátit.</p>
    </div>
  );
}
