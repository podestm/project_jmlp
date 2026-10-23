import { Button, Tooltip } from '../../ms/index.js';
import PrintRunButtons from '../PrintRunButtons/PrintRunButtons.jsx';
import styles from './ResultsToolbar.module.css';

const ONLINE_ONLY = 'Vyžaduje připojení';

/**
 * Tisk a publikace výsledků (TkVysledky): listiny kol vybrané a všech
 * kategorií, celková listina, Publikovat, pořadí poháru
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
        <Button size="sm" icon="file" disabled={pdf.generating} onClick={() => api.printFinal(false)}>
          Celková listina
        </Button>
        <Tooltip text={ONLINE_ONLY}>
          <Button
            size="sm"
            variant="open"
            icon="upload"
            disabled={pdf.generating || !isOnline}
            onClick={() => api.printFinal(true)}
          >
            Publikovat
          </Button>
        </Tooltip>
        <div className={styles.group} role="group" aria-label="Pořadí poháru">
          <Tooltip text={ONLINE_ONLY}>
            <Button
              size="sm"
              icon="chart"
              disabled={pdf.generating || !isOnline || noSeason}
              onClick={() => api.printStandings(false)}
            >
              Pohár průběžně
            </Button>
          </Tooltip>
          <Tooltip text="Po skončení sezóny">
            <Button
              size="sm"
              disabled={pdf.generating || !isOnline || noSeason}
              onClick={() => api.printStandings(true)}
            >
              celkově
            </Button>
          </Tooltip>
        </div>
        <Tooltip text="Startovní listina zůstane" className={styles.clear}>
          <Button size="sm" variant="danger" icon="trash" busy={clearing} onClick={api.clearResults}>
            Smazat výsledky
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
