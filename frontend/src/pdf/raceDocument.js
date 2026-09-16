/**
 * Společný skelet tištěných listin závodu.
 *
 * Výsledková i startovní listina mají stejnou hlavičku (modrý pás s logy,
 * činovníci, údaje o kolech), stejný velký nadpis a stejnou patičku - liší se
 * jen tabulkami uprostřed. Tohle je ta společná část, aby druhá listina
 * nevznikla jako kopie první a nerozešly se.
 */
import {
  COLORS,
  FONT_SIZES,
  PAGE_MARGINS,
  formatHeaderDate,
  labelValueRow
} from './theme.js';

/** Modrý pás s logy a názvem seriálu. */
export const headerBand = (header) => ({
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

/** Kolo, které nemá vyplněný jediný údaj, se do hlavičky netiskne. */
export const hasRunData = (run) => [
  run.course_setter,
  run.gates_count,
  run.conditions,
  run.start_time,
  run.course_length_m
].some((value) => value !== null && value !== undefined && String(value).trim() !== '');

export const runBlock = (run) => [
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

/**
 * Hlavička listiny - činovníci, pořadatel, místo a bloky kol.
 *
 * @param {object} header
 * @param {(run: object) => boolean} [runFilter] které kolo se má vytisknout;
 *   listina jednoho kola nese jen údaje o tom kole.
 */
export const raceHeaderSection = (header, runFilter = () => true) => [
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
  ...(header.runs || []).filter(runFilter).filter(hasRunData).flatMap(runBlock)
];

export const bigTitle = (title) => ({
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

const pageFooter = (currentPage) => ({
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
});

/**
 * Definice dokumentu pro pdfmake - A4 na výšku, hlavička, nadpis, obsah.
 *
 * @param {object}  options
 * @param {object?} options.header   hlavičkové údaje; null = bez hlavičky
 * @param {string}  options.title
 * @param {Array}   options.content  bloky tabulek pod nadpisem
 * @param {(run: object) => boolean} [options.runFilter]
 */
export function buildRaceDoc({ header = null, title, content = [], runFilter }) {
  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: PAGE_MARGINS,
    defaultStyle: { fontSize: FONT_SIZES.cell, color: COLORS.text },
    content: [
      ...(header ? raceHeaderSection(header, runFilter) : []),
      bigTitle(title),
      ...content
    ],
    footer: pageFooter
  };
}
