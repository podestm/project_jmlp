import { useEffect, useState } from 'react';
import { TimekeeperAPI } from '../../../config/timekeeperApi.js';
import { useRacePdf } from '../../../hooks/useRacePdf.js';
import { pdfErrorMessage } from '../../../pdf/pdfmake.js';
import { dropRaceSnapshot } from '../../../offline/startListCache.js';
import { clearTimingDrafts } from '../../../offline/timingDrafts.js';
import { useSyncStatus } from '../../../offline/useSyncStatus.js';
import { formatDateLong } from '../../../utils/date.js';
import { readSelectedRaceId } from '../frame/selectedRace.js';
import { useSlcrExport } from './useSlcrExport.js';
import { clearResultsConfirm, publishConfirm } from './resultsDialogs.jsx';

/**
 * Data a akce obrazovky Výsledky (TkVysledky): načtení výsledků vybraného
 * závodu, tisk listin kol a celkové listiny, pořadí poháru, publikace
 * a smazání naměřených výsledků. Obrazovka jen skládá vzhled.
 *
 * @param {(options: object) => Promise<*>} confirm z useConfirm
 */
export function useResults({ confirm }) {
  const [races, setRaces] = useState([]);
  const [selectedRaceId] = useState(readSelectedRaceId);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [clearing, setClearing] = useState(false);

  const { isOnline, queueStats } = useSyncStatus();
  const pdf = useRacePdf(selectedRaceId);

  const loadRaces = async () => {
    try {
      const data = await TimekeeperAPI.get('/api/timekeeper/races');
      setRaces(data);
    } catch (err) { console.error('Failed to load races:', err); }
  };

  const loadResults = async () => {
    if (!selectedRaceId) return;
    try {
      setLoading(true);
      const data = await TimekeeperAPI.get(
        `/api/timekeeper/races/${selectedRaceId}/results`,
        { group_by_category: true }
      );
      setResults(data);
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst výsledky' });
    } finally { setLoading(false); }
  };

  useEffect(() => { loadRaces(); }, []);
  useEffect(() => { if (selectedRaceId) loadResults(); }, [selectedRaceId]);

  // Vybraná kategorie musí ve výsledcích existovat; jinak první.
  useEffect(() => {
    const categories = results?.categories || [];
    if (!categories.length) {
      setSelectedCategoryId('');
      return;
    }
    if (!categories.some((cat) => String(cat.category_id) === String(selectedCategoryId))) {
      setSelectedCategoryId(String(categories[0].category_id));
    }
  }, [results, selectedCategoryId]);

  const selectedRace = races.find((race) => String(race.id) === String(selectedRaceId)) || null;
  const categoryList = results?.categories || [];
  const selectedCategory = categoryList.find(
    (cat) => String(cat.category_id) === String(selectedCategoryId)
  ) || null;

  const slcr = useSlcrExport({
    raceId: selectedRaceId,
    race: selectedRace,
    onError: (text) => setMessage({ type: 'danger', text }),
  });

  const reportPdfError = (err) => {
    console.error('PDF se nepodařilo vytvořit:', err);
    setMessage({ type: 'danger', text: pdfErrorMessage(err) });
  };

  /** Listina kola jedné kategorie – bez hlavičky, takže funguje i offline. */
  const printCategory = async (runMode) => {
    if (!selectedCategory) return;
    try {
      await pdf.generate({
        categories: [selectedCategory], interim: true, runMode, categoryName: selectedCategory.category_name
      });
    } catch (err) { reportPdfError(err); }
  };

  /** Listina kola všech kategorií. */
  const printAllInterim = async (runMode) => {
    try {
      await pdf.generate({ categories: categoryList, interim: true, runMode });
    } catch (err) { reportPdfError(err); }
  };

  const printFinal = async (publishable) => {
    try {
      await pdf.generate({ categories: categoryList, interim: false, publishable });
    } catch (err) { reportPdfError(err); }
  };

  /**
   * Smazání naměřených výsledků.
   *
   * Záměrně jen online: kdyby se tahle operace uložila do offline fronty,
   * přehrála by se třeba za hodinu a smazala i časy naměřené mezitím.
   * Ze stejného důvodu se nepustí, dokud fronta není prázdná – čekající zápis
   * času by se po smazání přehrál a část výsledků vrátil zpátky.
   */
  const clearResults = async () => {
    if (!selectedRaceId) return;

    if (!isOnline) {
      setMessage({
        type: 'warning',
        text: 'Mazání výsledků vyžaduje připojení k internetu - offline by se smazání přehrálo až později a vzalo s sebou i mezitím naměřené časy.'
      });
      return;
    }
    if (queueStats.total > 0) {
      setMessage({
        type: 'warning',
        text: `Ve frontě čeká ${queueStats.total} nesynchronizovaných změn. Nejdřív je nechte odeslat (Synchronizace), jinak by se po smazání přehrály zpátky.`
      });
      return;
    }

    const choice = await confirm(clearResultsConfirm({ race: selectedRace, total: results?.total_entries }));
    if (!choice) return;

    try {
      setClearing(true);
      const result = await TimekeeperAPI.deleteOnline(
        `/api/timekeeper/races/${selectedRaceId}/results?published=${choice === 'all'}`
      );
      // Lokální stopy po naměřených časech musí zmizet taky: nakešovaná
      // startovka i rozepsané drafty by je jinak vrátily do hry.
      await dropRaceSnapshot(selectedRaceId);
      await clearTimingDrafts(selectedRaceId);
      setMessage({ type: 'info', text: result.message });
      loadResults();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Výsledky se nepodařilo smazat' });
    } finally {
      setClearing(false);
    }
  };

  /**
   * Pořadí poháru za sezónu vybraného závodu. Počítá ho server ze všech
   * závodů sezóny; závody bez výsledků v aplikaci (měřené jen v LiZe)
   * v něm chybí, a to musí obsluha vědět dřív, než pořadí zveřejní.
   */
  const printStandings = async (final) => {
    if (!selectedRace?.season_id) return;
    try {
      const standings = await pdf.generateStandings({ seasonId: selectedRace.season_id, final });
      const missing = standings?.races_without_results || [];
      if (missing.length) {
        setMessage({
          type: 'warning',
          text: `V pořadí chybí závody bez výsledků v aplikaci: ${missing
            .map((race) => `${race.race_nr} (${formatDateLong(race.datum)})`)
            .join(', ')}.`
        });
      }
    } catch (err) { reportPdfError(err); }
  };

  const publishResults = async () => {
    const confirmed = await confirm(publishConfirm({ target: pdf.publishTarget, fileName: pdf.fileName, race: selectedRace }));
    if (!confirmed) return;

    try {
      const result = await pdf.publish();
      pdf.closePreview();
      setMessage({ type: 'success', text: result.message });
      loadResults();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  };

  return {
    selectedRaceId,
    selectedRace,
    results,
    loading,
    message,
    clearMessage: () => setMessage(null),
    categoryList,
    selectedCategory,
    selectedCategoryId,
    setSelectedCategoryId,
    isOnline,
    queueStats,
    pdf,
    clearing,
    printCategory,
    printAllInterim,
    printFinal,
    printStandings,
    clearResults,
    publishResults,
    slcr,
  };
}
