/**
 * Generátor startovní listiny.
 *
 * Stejně jako výsledková listina vzniká v prohlížeči, takže se dá vytisknout
 * i na závodišti bez připojení - data má obrazovka nakešovaná v IndexedDB.
 * Hlavička, nadpis i patička jsou společné, viz raceDocument.js.
 *
 * Tiskne se v pořadí startu: kategorie podle nastaveného pořadí a uvnitř
 * podle startovních čísel - to je pořadí, ve kterém rozhodčí odbavuje závodníky.
 */
import { buildRaceDoc } from './raceDocument.js';
import {
  COLUMNS_START_LIST,
  FONT_SIZES,
  tableLayout
} from './theme.js';

export const TITLE_START_LIST = 'STARTOVNÍ LISTINA';

const COLUMN_LABELS = ['St.č.', 'Dres', 'Jméno', 'ročník', 'Startuje za'];

/** Jméno ve dvou řádcích: příjmení tučně, křestní pod ním - jako ve výsledcích. */
const nameCell = (entry) => ({
  stack: [
    { text: entry.racer_surname || '', bold: true, fontSize: FONT_SIZES.cell },
    { text: entry.racer_name || '', fontSize: FONT_SIZES.cellSmall }
  ]
});

const entryRow = (entry) => ([
  { text: entry.start_number != null ? String(entry.start_number) : '', alignment: 'center', bold: true },
  { text: entry.race_number_actual != null ? String(entry.race_number_actual) : '', alignment: 'center' },
  nameCell(entry),
  { text: entry.racer_year != null ? String(entry.racer_year) : '', alignment: 'center' },
  { text: entry.club_name || '', fontSize: FONT_SIZES.cellSmall }
].map((cell) => ({ fontSize: FONT_SIZES.cell, ...cell })));

const categoryBlock = (category) => [
  {
    text: `${category.category_name}${category.entries.length ? ` (${category.entries.length})` : ''}`,
    bold: true,
    fontSize: 12,
    margin: [0, 8, 0, 3]
  },
  {
    table: {
      // Hlavička sloupců a distanční řádek dvojlinky se opakují po zlomu stránky.
      headerRows: 2,
      // Jméno je ve dvou řádcích - bez tohohle se buňka rozlomí přes stránku.
      dontBreakRows: true,
      keepWithHeaderRows: 1,
      widths: COLUMNS_START_LIST,
      body: [
        COLUMN_LABELS.map((label) => ({
          text: label,
          bold: true,
          fontSize: FONT_SIZES.tableHeader
        })),
        COLUMNS_START_LIST.map(() => ({ text: '', fontSize: 1, margin: [0, 0, 0, 0] })),
        ...category.entries.map(entryRow)
      ]
    },
    layout: tableLayout
  }
];

/**
 * Sestaví definici startovní listiny pro pdfmake.
 *
 * @param {object}   options
 * @param {object?}  options.header      hlavičkové údaje závodu; null = bez hlavičky
 * @param {Array}    options.categories  [{ category_name, entries }] v pořadí startu
 * @param {string}   [options.title]
 */
export function buildStartListDoc({ header = null, categories = [], title = TITLE_START_LIST }) {
  return buildRaceDoc({
    header,
    title,
    content: categories.flatMap(categoryBlock)
  });
}

/** Název souboru pro stažení. */
export const startListFileName = (raceNumberLabel) =>
  `startovka_${(raceNumberLabel || 'zavod').replace(/[^\w-]/g, '')}.pdf`;
