import { Alert, Icon } from '../../ms/index.js';
import dialogStyles from '../dialogs/dialogs.module.css';
import styles from './resultsDialogs.module.css';

const FileCard = ({ fileName, detail }) => (
  <div className={styles.file}>
    <Icon name="file" size={24} className={styles.fileIcon} />
    <span>
      <span className={styles.fileName}>{fileName}</span>
      {detail && <span className={styles.fileDetail}>{detail}</span>}
    </span>
  </div>
);

/**
 * Potvrzení publikace nad náhledem PDF: výsledková listina k závodu
 * (TkDialogPublikovatListinu), nebo pořadí poháru u sezóny
 * (TkDialogZverejnitPoradiPoharu). Publikace je běžná akce – fokus na ní.
 */
export const publishConfirm = ({ target, fileName, race }) => {
  if (target?.kind === 'standings') {
    const what = target.final ? 'celkové' : 'průběžné';
    return {
      title: `Zveřejnit ${what} výsledky poháru?`,
      message: (
        <>
          <p>
            Pořadí se zveřejní na webu u sezóny {target.seasonLabel || ''} a nahradí dosavadní průběžné
            nebo celkové výsledky.
          </p>
          {fileName && <FileCard fileName={fileName} detail={`${target.final ? 'Celkové' : 'Průběžné'} výsledky poháru`} />}
          <p className={dialogStyles.caps}>Co se stane</p>
          <ul className={dialogStyles.list}>
            <li>Sezóna má vždy jen jeden výsledkový dokument – dosavadní průběžné nebo celkové výsledky zmizí.</li>
            <li>Zveřejnění nikdy nejde do offline fronty. Když spojení během odesílání spadne, nic se nezveřejní a můžete to zkusit znovu.</li>
          </ul>
        </>
      ),
      confirmLabel: 'Zveřejnit',
      icon: 'upload',
    };
  }
  return {
    title: 'Publikovat výsledkovou listinu?',
    message: (
      <>
        <p>Soubor bude připojen k závodu a zveřejněn na webu. Nahradí dosud publikovanou listinu.</p>
        {fileName && <FileCard fileName={fileName} detail="Celková výsledková listina" />}
        <p className={dialogStyles.caps}>Co se stane</p>
        <ul className={dialogStyles.list}>
          <li>Listina se připojí k závodu{race?.race_nr ? ` ${race.race_nr}` : ''} a hned je vidět na webu.</li>
          <li>Publikace nikdy nejde do offline fronty. Když spojení během odesílání spadne, nic se nezveřejní a můžete to zkusit znovu.</li>
        </ul>
      </>
    ),
    confirmLabel: 'Publikovat',
    icon: 'upload',
  };
};

/**
 * Smazání naměřených výsledků. Obě volby jsou nebezpečné, fokus (a Enter)
 * proto dostane Zrušit.
 */
export const clearResultsConfirm = ({ race, total }) => ({
  title: `Smazat naměřené výsledky závodu${race?.areal_name ? ` ${race.areal_name}` : ''}?`,
  message: (
    <>
      <p>
        Smažou se časy obou kol, příznaky DNF/DNS/DSQ i body
        {total ? ` u všech ${total} závodníků` : ' u všech závodníků'}.
        Startovní listina zůstane, závod se dá měřit znovu bez opakovaného losování.
      </p>
      <Alert type="warning" compact title="Akce je nevratná">
        Mazání jde jen online a s prázdnou frontou – jinak by se čekající časy po smazání vrátily zpátky.
      </Alert>
    </>
  ),
  cancelLabel: 'Zrušit',
  choices: [
    { value: 'times', label: 'Smazat naměřené časy', danger: true, icon: 'trash' },
    { value: 'all', label: 'Smazat časy i publikovanou listinu', danger: true, icon: 'trash' },
  ],
});
