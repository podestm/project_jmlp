/**
 * Generátor výsledkové listiny.
 *
 * Běží v prohlížeči, ne na serveru - jinak by tisk průběžných výsledků na
 * závodě bez připojení nefungoval. Data pro listinu jsou offline k dispozici
 * z IndexedDB (viz offline/timekeeperOffline.js).
 *
 * Celková listina a průběžné výsledky se liší jen vstupem, ne kódem:
 * průběžné = `header: null` a filtr na jednu kategorii.
 */
import {
  COLORS,
  COLUMNS_ONE_RUN,
  COLUMNS_TWO_RUNS,
  FONT_SIZES,
  PAGE_MARGINS,
  formatDiff,
  formatHeaderDate,
  formatTime,
  labelValueRow,
  tableLayout
} from './theme.js';

export const TITLE_FINAL = 'CELKOVÁ VÝSLEDKOVÁ LISTINA';
export const TITLE_INTERIM = 'PRŮBĚŽNÉ VÝSLEDKY';

// V databázi není národnost, všichni závodníci jsou čeští.
const NATIONALITY = 'CZE';

const headerColumns = (runCount) => {
  const base = ['Pořadí', 'Jméno', 'st.č.', 'ročník', 'Startuje za', 'Stát', '1.kolo'];
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

const entryRow = (entry, runCount) => {
  const status = entry.status;
  const rank = entry.position ?? entry.display_rank;
  const points = entry.points ?? entry.display_points ?? 0;
  const diff = entry.diff ?? entry.display_diff;

  const cells = [
    { text: rank ? String(rank) : '', alignment: 'center', bold: true },
    nameCell(entry),
    { text: entry.start_number != null ? String(entry.start_number) : '', alignment: 'center' },
    { text: entry.racer_year != null ? String(entry.racer_year) : '', alignment: 'center' },
    { text: entry.club_name || '', fontSize: FONT_SIZES.cellSmall },
    { text: NATIONALITY, alignment: 'center', fontSize: FONT_SIZES.cellSmall },
    { text: formatTime(entry.time1), alignment: 'right' }
  ];

  if (runCount === 2) {
    cells.push({ text: formatTime(entry.time2), alignment: 'right' });
  }

  // Nedokončivší mají místo součtu stav a nemají pořadí ani ztrátu.
  cells.push({
    text: status || formatTime(entry.time_sum),
    alignment: 'right',
    bold: true
  });
  cells.push({ text: status ? '' : formatDiff(diff), alignment: 'right' });
  cells.push({ text: String(points), alignment: 'center' });

  return cells.map((cell) => ({ fontSize: FONT_SIZES.cell, ...cell }));
};

const categoryBlock = (category, runCount) => {
  const columns = runCount === 2 ? COLUMNS_TWO_RUNS : COLUMNS_ONE_RUN;

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
          headerColumns(runCount).map((label) => ({
            text: label,
            bold: true,
            fontSize: FONT_SIZES.tableHeader
          })),
          columns.map(() => ({ text: '', fontSize: 1, margin: [0, 0, 0, 0] })),
          ...category.entries.map((entry) => entryRow(entry, runCount))
        ]
      },
      layout: tableLayout
    }
  ];
};

/** Modrý pás s logy a názvem seriálu. */
const headerBand = (header) => ({
  table: {
    widths: [70, '*', 70],
    body: [[
      header.leftLogo
        ? { image: header.leftLogo, fit: [64, 44], alignment: 'center', margin: [2, 2, 2, 2] }
        : { text: '', margin: [2, 2, 2, 2] },
      {
        text: `${header.seasonName || 'Jihomoravský lyžařský pohár'} - ${header.editionLabel || ''}ročník`,
        bold: true,
        fontSize: FONT_SIZES.title,
        alignment: 'center',
        margin: [0, 12, 0, 0]
      },
      header.rightLogo
        ? { image: header.rightLogo, fit: [64, 44], alignment: 'center', margin: [2, 2, 2, 2] }
        : { text: '', margin: [2, 2, 2, 2] }
    ]]
  },
  layout: {
    hLineWidth: () => 0,
    vLineWidth: () => 0,
    fillColor: () => COLORS.bandBackground
  },
  margin: [0, 0, 0, 6]
});

const runBlock = (run) => [
  {
    text: `${run.run_number}.KOLO`,
    bold: true,
    fontSize: 11,
    alignment: 'center',
    margin: [0, 6, 0, 3]
  },
  labelValueRow('STAVITEL TRATI', run.course_setter),
  labelValueRow('BRANEK', run.gates_count != null ? String(run.gates_count) : ''),
  labelValueRow('PODMÍNKY', run.conditions),
  labelValueRow('ČAS STARTU', run.start_time),
  labelValueRow('DÉLKA TRATI', run.course_length_m != null ? `${run.course_length_m}m` : '')
];

const headerSection = (header) => [
  headerBand(header),
  labelValueRow('ČÍSLO ZÁVODU', header.raceNumberLabel, 160),
  labelValueRow('ŘEDITEL ZÁVODU', header.raceDirector),
  labelValueRow('TD', header.technicalDelegate),
  labelValueRow('HLAVNÍ ČASOMĚŘIČ', header.chiefTimekeeper),
  labelValueRow('POŘADATEL', header.organizerName),
  labelValueRow(
    'DATUM A MÍSTO',
    [formatHeaderDate(header.raceDate), header.arealName].filter(Boolean).join(' ')
  ),
  ...(header.runs || []).flatMap(runBlock)
];

const bigTitle = (title) => ({
  table: {
    widths: ['*'],
    body: [[{
      text: title,
      bold: true,
      fontSize: FONT_SIZES.bigTitle,
      alignment: 'center',
      margin: [0, 4, 0, 4]
    }]]
  },
  layout: {
    hLineWidth: () => 2,
    vLineWidth: () => 0,
    hLineColor: () => COLORS.titleRule
  },
  margin: [0, 8, 0, 4]
});

/**
 * Sestaví definici dokumentu pro pdfmake.
 *
 * @param {object}   options
 * @param {object?}  options.header    hlavičkové údaje; null = bez hlavičky (průběžné)
 * @param {Array}    options.categories  [{ category_name, entries }]
 * @param {string}   options.title
 * @param {number}   options.runCount  1 nebo 2
 */
export function buildResultsDoc({ header = null, categories = [], title, runCount = 1 }) {
  const documentTitle = title || (header ? TITLE_FINAL : TITLE_INTERIM);

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: PAGE_MARGINS,
    defaultStyle: { fontSize: FONT_SIZES.cell, color: COLORS.text },
    content: [
      ...(header ? headerSection(header) : []),
      bigTitle(documentTitle),
      ...categories.flatMap((category) => categoryBlock(category, runCount))
    ],
    footer: (currentPage) => ({
      columns: [
        {
          text: `Vygenerováno ${new Date().toLocaleString('cs-CZ')}`,
          fontSize: FONT_SIZES.footer,
          color: COLORS.muted,
          margin: [34, 0, 0, 0]
        },
        {
          text: `Strana ${currentPage}`,
          fontSize: FONT_SIZES.footer,
          color: COLORS.muted,
          alignment: 'right',
          margin: [0, 0, 34, 0]
        }
      ]
    })
  };
}

/** Název souboru pro stažení / publikaci. */
export const resultsFileName = (raceNumberLabel, interim) =>
  `${interim ? 'prubezne' : 'vysledky'}_${(raceNumberLabel || 'zavod').replace(/[^\w-]/g, '')}.pdf`;
