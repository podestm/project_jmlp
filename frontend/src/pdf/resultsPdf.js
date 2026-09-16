/**
 * Generátor výsledkové listiny.
 *
 * Běží v prohlížeči, ne na serveru - jinak by tisk průběžných výsledků na
 * závodě bez připojení nefungoval. Data pro listinu jsou offline k dispozici
 * z IndexedDB (viz offline/timekeeperOffline.js).
 *
 * Celková listina, průběžné výsledky i listina jednoho kola se liší jen
 * vstupem, ne kódem: průběžné = `header: null`, jedno kolo = `runMode: '1'|'2'`
 * a kategorie se předávají už vyfiltrované.
 */
import { buildRaceDoc } from './raceDocument.js';
import {
  COLUMNS_ONE_RUN,
  COLUMNS_SINGLE_RUN,
  COLUMNS_TWO_RUNS,
  FONT_SIZES,
  formatDiff,
  formatTime,
  tableLayout
} from './theme.js';

export const TITLE_FINAL = 'CELKOVÁ VÝSLEDKOVÁ LISTINA';
export const TITLE_INTERIM = 'PRŮBĚŽNÉ VÝSLEDKY';
export const titleForRun = (runNumber) => `VÝSLEDKY ${runNumber}. KOLA`;

/**
 * Co se v listině tiskne:
 *   'sum'  - celkový výsledek, počet kol se pozná z dat každé kategorie zvlášť
 *   '1'    - jen 1. kolo
 *   '2'    - jen 2. kolo
 *
 * Počet kol se záměrně neptá závodu: jedna kategorie může jet obě kola a jiná
 * jen jedno, takže sloupce určují naměřená data kategorie.
 */
export const RUN_MODE_SUM = 'sum';

// V databázi není národnost, všichni závodníci jsou čeští.
const NATIONALITY = 'CZE';

/** Kolik kol má kategorie naměřeno - podle dat, ne podle nastavení závodu. */
export const categoryRunCount = (category) =>
  (category.entries || []).some((entry) => entry.time2 != null) ? 2 : 1;

const runColumns = (runMode, runCount) => {
  if (runMode !== RUN_MODE_SUM) return COLUMNS_SINGLE_RUN;
  return runCount === 2 ? COLUMNS_TWO_RUNS : COLUMNS_ONE_RUN;
};

const headerColumns = (runMode, runCount) => {
  const base = ['Pořadí', 'Jméno', 'st.č.', 'ročník', 'Startuje za', 'Stát'];
  if (runMode !== RUN_MODE_SUM) return [...base, `${runMode}.kolo`, 'DIF', 'PT'];

  base.push('1.kolo');
  if (runCount === 2) base.push('2.kolo');
  return [...base, 'Součet', 'DIF', 'PT'];
};

/** Jméno ve dvou řádcích: příjmení tučně, křestní pod ním. */
const nameCell = (entry) => ({
  stack: [
    { text: entry.racer_surname || '', bold: true, fontSize: FONT_SIZES.cell },
    { text: entry.racer_name || '', fontSize: FONT_SIZES.cellSmall }
  ]
});

const entryRow = (entry, runMode, runCount) => {
  const status = entry.status;
  const rank = entry.position ?? entry.display_rank;
  // Body vždy z pořadí v této sestavě: v listině jednoho kola nemají uložené
  // body ze součtu co dělat.
  const points = (runMode === RUN_MODE_SUM ? entry.points ?? entry.display_points : entry.display_points) ?? 0;
  const diff = runMode === RUN_MODE_SUM ? entry.diff ?? entry.display_diff : entry.display_diff;

  const cells = [
    { text: rank ? String(rank) : '', alignment: 'center', bold: true },
    nameCell(entry),
    { text: entry.start_number != null ? String(entry.start_number) : '', alignment: 'center' },
    { text: entry.racer_year != null ? String(entry.racer_year) : '', alignment: 'center' },
    { text: entry.club_name || '', fontSize: FONT_SIZES.cellSmall },
    { text: NATIONALITY, alignment: 'center', fontSize: FONT_SIZES.cellSmall }
  ];

  if (runMode !== RUN_MODE_SUM) {
    // Jedno kolo: čas kola je zároveň výsledek, sloupec Součet by byl jeho kopie.
    const time = runMode === '2' ? entry.time2 : entry.time1;
    cells.push({ text: status || formatTime(time), alignment: 'right', bold: true });
  } else {
    cells.push({ text: formatTime(entry.time1), alignment: 'right' });
    if (runCount === 2) {
      cells.push({ text: formatTime(entry.time2), alignment: 'right' });
    }
    // Nedokončivší mají místo součtu stav a nemají pořadí ani ztrátu.
    cells.push({ text: status || formatTime(entry.time_sum), alignment: 'right', bold: true });
  }

  cells.push({ text: status ? '' : formatDiff(diff), alignment: 'right' });
  cells.push({ text: String(points), alignment: 'center' });

  return cells.map((cell) => ({ fontSize: FONT_SIZES.cell, ...cell }));
};

const categoryBlock = (category, runMode) => {
  const runCount = categoryRunCount(category);
  const columns = runColumns(runMode, runCount);

  return [
    {
      text: category.category_name,
      bold: true,
      fontSize: 12,
      margin: [0, 8, 0, 3]
    },
    {
      table: {
        // Dva - hlavička sloupců a distanční řádek, který dělá dvojlinku.
        // Oba se opakují po zlomu stránky.
        headerRows: 2,
        // Jméno je ve dvou řádcích - bez tohohle se buňka rozlomí přes stránku
        // a na jedné zůstane příjmení bez klubu.
        dontBreakRows: true,
        keepWithHeaderRows: 1,
        widths: columns,
        body: [
          headerColumns(runMode, runCount).map((label) => ({
            text: label,
            bold: true,
            fontSize: FONT_SIZES.tableHeader
          })),
          columns.map(() => ({ text: '', fontSize: 1, margin: [0, 0, 0, 0] })),
          ...category.entries.map((entry) => entryRow(entry, runMode, runCount))
        ]
      },
      layout: tableLayout
    }
  ];
};

/**
 * Sestaví definici dokumentu pro pdfmake.
 *
 * @param {object}   options
 * @param {object?}  options.header    hlavičkové údaje; null = bez hlavičky (průběžné)
 * @param {Array}    options.categories  [{ category_name, entries }]
 * @param {string}   options.title
 * @param {string}   options.runMode   'sum' | '1' | '2' (viz RUN_MODE_SUM)
 */
export function buildResultsDoc({ header = null, categories = [], title, runMode = RUN_MODE_SUM }) {
  const documentTitle = title
    || (runMode !== RUN_MODE_SUM ? titleForRun(runMode) : (header ? TITLE_FINAL : TITLE_INTERIM));

  return buildRaceDoc({
    header,
    title: documentTitle,
    content: categories.flatMap((category) => categoryBlock(category, runMode)),
    // Listina jednoho kola nese jen údaje o tom kole; jinak se tisknou všechna
    // vyplněná kola - kolik jich závod měl, se pozná z nich, ne z nastavení.
    runFilter: (run) => runMode === RUN_MODE_SUM || String(run.run_number) === String(runMode)
  });
}

/** Název souboru pro stažení / publikaci. */
export const resultsFileName = (raceNumberLabel, interim, runMode = RUN_MODE_SUM) => {
  const kind = runMode !== RUN_MODE_SUM
    ? `${runMode}kolo`
    : (interim ? 'prubezne' : 'vysledky');
  return `${kind}_${(raceNumberLabel || 'zavod').replace(/[^\w-]/g, '')}.pdf`;
};
