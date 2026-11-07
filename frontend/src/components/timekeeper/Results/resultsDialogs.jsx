import { Alert, Icon } from '../../ms/index.js';
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
            Pořadí se zveřejní u sezóny {target.seasonLabel || ''} a nahradí dosavadní výsledky
            poháru.
          </p>
          {fileName && (
            <FileCard
              fileName={fileName}
              detail={`${target.final ? 'Celkové' : 'Průběžné'} výsledky poháru`}
            />
          )}
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
        <p>
          Listina se připojí k závodu{race?.race_nr ? ` ${race.race_nr}` : ''}, hned je vidět na
          webu a nahradí dosud publikovanou.
        </p>
        {fileName && <FileCard fileName={fileName} detail="Celková výsledková listina" />}
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
        {total ? ` u všech ${total} závodníků` : ' u všech závodníků'}. Startovní listina zůstane.
      </p>
      <Alert type="warning" compact title="Akce je nevratná" />
    </>
  ),
  cancelLabel: 'Zrušit',
  choices: [
    { value: 'times', label: 'Smazat naměřené časy', danger: true, icon: 'trash' },
    { value: 'all', label: 'Smazat časy i publikovanou listinu', danger: true, icon: 'trash' },
  ],
});
