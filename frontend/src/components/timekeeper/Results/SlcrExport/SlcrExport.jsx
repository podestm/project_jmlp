import { Button, Select } from '../../../ms/index.js';
import { SLCR_DISCIPLINES } from '../useSlcrExport.js';
import styles from './SlcrExport.module.css';

/** Výběr disciplíny + stažení výsledků jako FIS XML pro evidenci SLČR (jen online). */
export default function SlcrExport({ discipline, onDisciplineChange, exporting, onExport, isOnline }) {
  return (
    <div className={styles.group} role="group" aria-label="Výsledky pro SLČR">
      <Select
        size="sm"
        className={styles.discipline}
        value={discipline}
        onChange={(event) => onDisciplineChange(event.target.value)}
        aria-label="Disciplína pro SLČR"
        title="Disciplína FIS do XML (u suchých závodů lze nechat prázdnou)"
      >
        <option value="">Disciplína –</option>
        {SLCR_DISCIPLINES.map((code) => <option key={code} value={code}>{code}</option>)}
      </Select>
      <Button
        size="sm"
        icon="download"
        busy={exporting}
        disabled={!isOnline}
        onClick={onExport}
        title={isOnline
          ? 'Výsledky jako FIS XML Dataset pro evidenci SLČR (Hromadně nahrát → FIS XML Dataset, Fiscode = České číslo závodníka)'
          : 'Export vyžaduje připojení k internetu'}
      >
        XML pro SLČR
      </Button>
    </div>
  );
}
