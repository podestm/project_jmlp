import { useRacePdf } from '../../../hooks/useRacePdf.js';
import { pdfErrorMessage } from '../../../pdf/pdfmake.js';
import { SECOND_RUN_SAME } from '../../../pdf/liza/adapters.js';
import { activeEntries, groupEntriesByCategory } from '../startListHelpers.js';

/**
 * Tisk ze startovní listiny – startovky kol a rozpis po klubech, vždy bez
 * vyřazených. Funguje i offline (pdfmake je v keši).
 */
export const useStartListPrint = (selectedRaceId, startList, setMessage) => {
  const pdf = useRacePdf(selectedRaceId);

  /** Kategorie k tisku v pořadí startu - bez vyřazených závodníků. */
  const printableCategories = () => groupEntriesByCategory(activeEntries(startList));

  const warnNobodyLeft = () => setMessage({
    type: 'warning',
    text: 'Na startovní listině nikdo není - všichni závodníci jsou vyřazení.'
  });

  const run = async (generateFn) => {
    const categories = printableCategories();
    if (categories.length === 0) {
      warnNobodyLeft();
      return;
    }
    try {
      await generateFn(categories);
    } catch (err) {
      console.error('PDF se nepodařilo vytvořit:', err);
      setMessage({ type: 'danger', text: pdfErrorMessage(err) });
    }
  };

  /**
   * Startovní listina kola do PDF - všechny kategorie v pořadí startu, bez
   * vyřazených. Do 2. kola jdou jen ti, kdo 1. kolo dokončili; pořadí buď
   * stejné jako v 1. kole, nebo podle výsledků 1. kola (nejrychlejší první).
   */
  const printStartList = (round = 1, order = SECOND_RUN_SAME) => (
    run((categories) => pdf.generateStartList({ categories, round, order }))
  );

  /** Rozpis startujících po klubech - podklad pro vedoucí oddílů, bez vyřazených. */
  const printClubList = () => run((categories) => pdf.generateClubList({ categories }));

  return { pdf, printStartList, printClubList };
};
