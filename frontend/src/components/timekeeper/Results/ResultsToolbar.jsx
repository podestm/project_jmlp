import { Button, Tooltip } from '../../ms/index.js';
import PrintRunButtons from '../PrintRunButtons/PrintRunButtons.jsx';
import styles from './ResultsToolbar.module.css';

const ONLINE_ONLY = 'Vyžaduje připojení';

/**
 * Tisk a publikace výsledků (TkVysledky): listiny kol vybrané a všech
 * kategorií, celková listina (online s publikací k závodu v náhledu),
 * pořadí poháru (průběžné, po finále celkové – rozhodne server)
 * a smazání výsledků. Listiny se skládají v notebooku (i offline),
 * publikace a pohár jen online.
 */
export default function ResultsToolbar({ api }) {
  const { pdf, isOnline, selectedCategory, selectedRace, clearing } = api;
  const noSeason = !selectedRace?.season_id;

  return (
    <div className={styles.toolbar}>
      <div className={styles.row}>
        <PrintRunButtons
          label="Tisk kategorie"
          busy={pdf.generating}
          disabled={!selectedCategory}
          onPrint={api.printCategory}
        />
        <PrintRunButtons
          label="Všechny kategorie"
          busy={pdf.generating}
          onPrint={api.printAllInterim}
        />
        <Tooltip text={isOnline ? 'Náhled, tisk i publikace' : 'Publikace vyžaduje připojení'}>
          <Button
            size="sm"
            icon="file"
            disabled={pdf.generating}
            onClick={() => api.printFinal(isOnline)}
          >
            Celková listina
          </Button>
        </Tooltip>
        <Tooltip text={isOnline ? 'Průběžné, po finále celkové' : ONLINE_ONLY}>
          <Button
            size="sm"
            icon="chart"
            disabled={pdf.generating || !isOnline || noSeason}
            onClick={api.printStandings}
          >
            Pohár
          </Button>
        </Tooltip>
        <Tooltip text="Startovní listina zůstane" className={styles.clear}>
          <Button
            size="sm"
            variant="danger"
            icon="trash"
            busy={clearing}
            onClick={api.clearResults}
          >
            Smazat výsledky
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
