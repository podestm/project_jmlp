import { Button } from '../../ms/index.js';
import PrintRunButtons from '../PrintRunButtons/PrintRunButtons.jsx';
import styles from './ResultsToolbar.module.css';

const ONLINE_ONLY = 'Vyžaduje připojení k internetu';

/**
 * Tisk a publikace výsledků (TkVysledky): listiny kol vybrané a všech
 * kategorií, celková listina, Publikovat, pořadí poháru a smazání výsledků.
 * Listiny se skládají v notebooku (i offline), publikace a pohár jen online.
 */
export default function ResultsToolbar({ api }) {
  const { pdf, isOnline, selectedCategory, selectedRace, clearing } = api;
  const noSeason = !selectedRace?.season_id;

  return (
    <div className={styles.toolbar}>
      <div className={styles.row}>
        <PrintRunButtons
          label="Tisk kategorie"
          title="Výsledky kol vybrané kategorie - funguje i offline"
          busy={pdf.generating}
          disabled={!selectedCategory}
          onPrint={api.printCategory}
        />
        <PrintRunButtons
          label="Všechny kategorie"
          title="Výsledky kol všech kategorií - funguje i offline"
          busy={pdf.generating}
          onPrint={api.printAllInterim}
        />
        <Button size="sm" icon="file" disabled={pdf.generating} onClick={() => api.printFinal(false)}>
          Celková listina
        </Button>
        <Button
          size="sm"
          variant="open"
          icon="upload"
          disabled={pdf.generating || !isOnline}
          onClick={() => api.printFinal(true)}
          title={isOnline ? 'Vygeneruje listinu a nabídne její publikaci k závodu' : `Publikování: ${ONLINE_ONLY.toLowerCase()}`}
        >
          Publikovat
        </Button>
        <div className={styles.group} role="group" aria-label="Pořadí poháru">
          <Button
            size="sm"
            icon="chart"
            disabled={pdf.generating || !isOnline || noSeason}
            onClick={() => api.printStandings(false)}
            title={isOnline ? 'Průběžné výsledky poháru za sezónu tohoto závodu' : ONLINE_ONLY}
          >
            Pohár průběžně
          </Button>
          <Button
            size="sm"
            disabled={pdf.generating || !isOnline || noSeason}
            onClick={() => api.printStandings(true)}
            title={isOnline ? 'Celkové výsledky poháru - po skončení sezóny' : ONLINE_ONLY}
          >
            celkově
          </Button>
        </div>
        <Button
          size="sm"
          variant="danger"
          icon="trash"
          busy={clearing}
          className={styles.clear}
          onClick={api.clearResults}
          title="Smaže naměřené časy, příznaky a body; startovní listina zůstane"
        >
          Smazat výsledky
        </Button>
      </div>
      <p className={styles.note}>
        Listiny kol a celková listina se skládají tady v notebooku, takže se tisknou i offline.
        Publikovat a pořadí poháru jdou až s připojením{isOnline ? '.' : ' – teď jste offline.'}
      </p>
    </div>
  );
}
