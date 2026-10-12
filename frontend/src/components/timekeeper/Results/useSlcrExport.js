import { useState } from 'react';
import { downloadBlob, fetchBlob, timekeeperAuthHeaders } from '../../../config/api.js';

/** Disciplíny FIS, které evidence SLČR u výsledků přijímá. */
export const SLCR_DISCIPLINES = ['SL', 'GS', 'SG', 'DH'];

/** Název souboru: datum_číslo-závodu_vysledky-slcr.xml */
export const slcrFileName = (race, raceId) => {
  const stem = [race?.datum, race?.race_nr || `zavod-${raceId}`].filter(Boolean).join('_');
  return `${stem}_vysledky-slcr.xml`;
};

/**
 * Výsledky jako FIS XML Dataset pro evidenci SLČR – jeden soubor, všechny
 * kategorie. V evidenci: Tvorba výsledků → Hromadně nahrát → FIS XML Dataset,
 * Fiscode = České číslo závodníka. K závodům v akci se výsledky přiřadí podle
 * kodexu (= id kategorie). Disciplínu lze u suchých závodů nechat prázdnou.
 */
export function useSlcrExport({ raceId, race, onError }) {
  const [discipline, setDiscipline] = useState('');
  const [exporting, setExporting] = useState(false);

  const exportXml = async () => {
    if (!raceId) return;
    setExporting(true);
    try {
      const blob = await fetchBlob(`/api/timekeeper/races/${raceId}/results/fis-xml`, {
        params: discipline ? { discipline } : {},
        headers: timekeeperAuthHeaders(),
      });
      downloadBlob(blob, slcrFileName(race, raceId));
    } catch (err) {
      onError(err?.message || 'Export XML se nepodařil');
    } finally {
      setExporting(false);
    }
  };

  return { discipline, setDiscipline, exporting, exportXml };
}
