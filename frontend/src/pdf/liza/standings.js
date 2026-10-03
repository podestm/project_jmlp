/**
 * Pořadí Jihomoravského lyžařského poháru - průběžné a celkové výsledky.
 *
 * Předloha: pořadí, které pro JmLP vydával LIP (průběžné výsledky 28. 1.
 * a 23. 2. 2026, celkové výsledky 2025-26). A4 na šířku; sloupec za každý
 * závod sezóny ("P04.10" = přípravný 4. 10., S = na sněhu, F = finále),
 * v buňce "pořadí/body", započtené body podbarvené (zeleně přípravný,
 * šedomodře na sněhu), vpravo součty přípr. / sníh. / započtené.
 *
 * Data počítá backend (app/services/standings.py) - tady se jen sází.
 */
import { A4_LANDSCAPE, PdfCanvas, textWidth } from './layout.js';
import { FOOTER_TEXT } from './common.js';

const REGULAR8 = { size: 8.04 };
const REGULAR10 = { size: 9.96 };
const BOLD10 = { size: 9.96, bold: true };
const ITALIC8 = { size: 8.04, serif: true };
const ITALIC10 = { size: 9.96, serif: true };
const TITLE = { size: 18, serif: true, bold: true };
const SUBTITLE = { size: 18, serif: true };

export const SUBTITLE_INTERIM = 'Průběžné výsledky';
export const SUBTITLE_FINAL = 'Celkové výsledky';

const EXPLANATION = [
  'Výsledky z jednotlivých závodů jsou označeny písmenem',
  '(P-přípravný, S- slalom na sněhu, F-finále) a datumem konání.',
  'Uvedeno je vždy pořadí/přidělené body (vyznačeny jsou započtené body)',
  'V součtových sloupcích je uveden součet bodů v přípravných kolech,',
  'v závodech na sněhu a  suma započtených bodů. Body z přípravných závodů se',
  'započtou pouze při alespoň jedné účasti na závodech na sněhu.'
];
const POINTS_HEADER = 'BODY   přípr.      sníh.         za';

/** Podbarvení započtených bodů: přípravný závod, závod na sněhu (i finále). */
export const COUNTED_PREP = '#AFDAAD';
export const COUNTED_SNOW = '#BFCDDB';
const ROW_LINE = '#A0A0A0';

const ROW_PITCH = 12.24;
/** Účaří posledního řádku na stránce (LIP pustí ještě 570,72, další by byl 574,32). */
const LAST_ROW_BASE = 572.0;
const FIRST_HEADER_LINE = 110.16;
const NEXT_HEADER_LINE = 16.56;

/* Sloupce závodů leží v mřížce 0,72 bodu (1/100 palce): krok 33,3 bodu
   zaokrouhlený na mřížku, proto se mezery střídají 33,12 a 33,84. */
const GRID = 0.72;
const COLUMN_START = 331.2;
const COLUMN_PITCH = 33.3;
const CELL_WIDTH = 31.68;
const COLUMNS_END = 664.0;
const onGrid = (value) => Math.round(value / GRID) * GRID;

/** Levé okraje sloupců závodů; víc sloupců, než se vejde, se zúží. */
export function raceColumns(count) {
  const pitch = count > 1
    ? Math.min(COLUMN_PITCH, (COLUMNS_END - COLUMN_START - CELL_WIDTH) / (count - 1))
    : COLUMN_PITCH;
  const width = Math.min(CELL_WIDTH, pitch - 1.44);
  return Array.from({ length: count }, (_, index) => ({
    left: onGrid(COLUMN_START + pitch * index),
    head: onGrid(COLUMN_START + 0.9 + pitch * index),
    width
  }));
}

/** Text s víc mezerami za sebou: kousky na místa, kam by je dal sazeč. */
function spacedText(canvas, value, x, base, style) {
  let offset = 0;
  value.split(/( {2,})/).forEach((part) => {
    if (part && !/^ +$/.test(part)) canvas.text(part, x + offset, base, style);
    offset += textWidth(part, style);
  });
}

const formatDate = (value) => {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  const pad = (number) => String(number).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
};

function drawTitleBlock(canvas, { cupName, seasonLabel, final, printedOn, logo }) {
  if (final && logo?.dataUrl) {
    // Logo svazu vlevo nahoře má jen celkové pořadí.
    const box = { x1: 13.68, y1: 4.32, x2: 98.64, y2: 90.72 };
    const ratio = logo.width && logo.height ? logo.width / logo.height : 1;
    let width = box.x2 - box.x1;
    let height = width / ratio;
    if (height > box.y2 - box.y1) {
      height = box.y2 - box.y1;
      width = height * ratio;
    }
    const x = box.x1 + (box.x2 - box.x1 - width) / 2;
    const y = box.y1 + (box.y2 - box.y1 - height) / 2;
    canvas.image(logo.dataUrl, x, y, x + width, y + height);
  }

  canvas.text(formatDate(printedOn), 784.81, 17.4, { ...REGULAR8, align: 'right' });
  canvas.text(cupName, 144.72, 37.8, TITLE);
  const labelX = Math.max(370.08, 144.72 + textWidth(cupName, TITLE) + textWidth(' ', TITLE));
  canvas.text(seasonLabel, labelX, 37.56, TITLE);
  canvas.text(final ? SUBTITLE_FINAL : SUBTITLE_INTERIM, 146.88, 63.84, SUBTITLE);
  EXPLANATION.forEach((line, index) => spacedText(canvas, line, 492.48, 30.96 + 9 * index, REGULAR8));
  canvas.line(17.28, 84.24, 792.0, 84.24);
}

/** Hlavička sloupců; vrací y její spodní linky. */
function drawColumnHeader(canvas, columns, races, line) {
  const base = line - 3.36;
  canvas.text('pořadí', 18.72, base, ITALIC10);
  canvas.text('jméno a ročník', 75.6, base, ITALIC10);
  canvas.text('klub', 241.2, base, ITALIC10);
  races.forEach((race, index) => canvas.text(race.code, columns[index].head, base - 0.12, REGULAR8));
  spacedText(canvas, POINTS_HEADER, 668.16, base + 1.44, ITALIC10);
  canvas.line(15.12, line, 792.0, line);
  return line;
}

/** Tečkované linky nad kategorií: čárky 0,375 se zakulacenými konci. */
const DOTTED = { width: 0.375, dash: { length: 0.375, space: 0.375 }, cap: 'round' };

function drawCategoryHeader(canvas, name, top) {
  canvas.line(16.56, top, 49.68, top, DOTTED);
  canvas.line(211.68, top, 655.2, top, DOTTED);
  canvas.text(name, 204.48, top + 6.0, { ...BOLD10, align: 'right' });
}

/** Jak se tiskne součet: tučně s místem, obyčejně bez místa, nebo vůbec. */
function totalStyle(row, final) {
  if (row.rank != null) return BOLD10;
  if (final) return row.raced_on_snow ? BOLD10 : null;
  return REGULAR10;
}

function drawRow(canvas, row, base, columns, final, index) {
  if (row.rank != null) canvas.text(String(row.rank), 42.5, base, { ...REGULAR10, align: 'right' });
  const name = [row.surname, row.name].filter(Boolean).join(' ');
  // Tučně první tři řádky kategorie - u LIP podle řádku, ne podle místa
  // (v průběžném pořadí 28. 1. 2026 tak tučně i třetí řádek bez místa).
  const podium = index < 3;
  canvas.text(name, 48.96, podium ? base + 0.12 : base, { ...(podium ? BOLD10 : REGULAR10), maxWidth: 193.92 - 48.96 });
  if (row.year != null) canvas.text(String(row.year), 193.92, base - 0.72, REGULAR8);
  // Klub se ořízne o první sloupec závodu ("TJ Sokol Deštné v Orlických ho").
  canvas.text(row.club || '', 218.16, base - 0.72, { ...REGULAR8, maxWidth: COLUMN_START - 218.16 });

  row.cells.forEach((cell, index) => {
    if (!cell) return;
    const column = columns[index];
    if (cell.counted) {
      canvas.rect(column.left, base - 8.4, column.left + column.width, base + 3.12, {
        fill: cell.kind === 'P' ? COUNTED_PREP : COUNTED_SNOW
      });
    }
    canvas.text(cell.text, column.left + column.width / 2, base, { ...REGULAR8, align: 'center' });
  });

  if (row.prep_points > 0) canvas.text(String(row.prep_points), 714.95, base + 0.72, { ...REGULAR8, align: 'right' });
  if (row.snow_points > 0) canvas.text(String(row.snow_points), 749.51, base + 0.72, { ...REGULAR8, align: 'right' });
  const style = totalStyle(row, final);
  if (style) canvas.text(String(row.total), 786.23, style.bold ? base + 0.12 : base, { ...style, align: 'right' });

  canvas.line(36.0, base + 3.12, 792.0, base + 3.12, { color: ROW_LINE });
}

/* Seznam zpracovaných závodů pod posledním řádkem: po pěti do sloupce. */
const LEGEND_TITLE = 'Zpracované výsledky ze závodů:';
const LEGEND_PER_COLUMN = 5;
const LEGEND_COLUMN_PITCH = 156.96;

const legendBottom = (top, count) => top + 11.52 + 13.8 + ROW_PITCH * (Math.min(count, LEGEND_PER_COLUMN) - 1);

function drawLegend(canvas, races, line) {
  canvas.line(18.72, line, 792.0, line);
  const title = line + 11.52;
  canvas.text(LEGEND_TITLE, 17.28, title, ITALIC8);
  races.forEach((race, index) => {
    const column = Math.floor(index / LEGEND_PER_COLUMN);
    const base = title + 13.8 + ROW_PITCH * (index % LEGEND_PER_COLUMN);
    const codeX = 18.0 + LEGEND_COLUMN_PITCH * column;
    canvas.text(race.code, codeX, base, REGULAR8);
    canvas.text(race.areal_name || '', column === 0 ? 48.96 : codeX + 32.4, base, {
      ...REGULAR8, maxWidth: LEGEND_COLUMN_PITCH - 34
    });
  });
}

function drawFooter(canvas) {
  canvas.line(18.72, 580.32, 792.0, 580.32);
  canvas.text(FOOTER_TEXT, 20.16, 591.84, ITALIC8);
  canvas.text(String(canvas.pageNumber), 788.43, 591.96, { ...REGULAR8, align: 'right' });
}

/**
 * @param {object} options
 * @param {object} options.standings  odpověď /api/timekeeper/seasons/{id}/standings
 * @param {string|Date} [options.printedOn]  datum v záhlaví (výchozí dnes)
 * @param {{dataUrl, width, height}} [options.logo]  logo svazu do celkových výsledků
 */
export function buildStandingsDoc({ standings, printedOn = new Date(), logo = null }) {
  const final = Boolean(standings.final);
  const races = standings.races || [];
  const columns = raceColumns(races.length);
  const canvas = new PdfCanvas(A4_LANDSCAPE);

  drawTitleBlock(canvas, {
    cupName: standings.cup_name || 'Jihomoravský lyžařský pohár',
    seasonLabel: standings.season_label || '',
    final,
    printedOn,
    logo
  });
  drawColumnHeader(canvas, columns, races, FIRST_HEADER_LINE);
  // Účaří "předchozího řádku" - kategorie i řádky se odvíjejí od něj.
  let base = FIRST_HEADER_LINE - 2.4;

  const nextPage = () => {
    drawFooter(canvas);
    canvas.newPage();
    drawColumnHeader(canvas, columns, races, NEXT_HEADER_LINE);
    base = NEXT_HEADER_LINE - 2.4;
  };

  (standings.categories || []).forEach((category) => {
    if (!category.rows?.length) return;
    // Nadpis kategorie jen s aspoň jedním řádkem pod sebou.
    if (base + 25.92 > LAST_ROW_BASE) nextPage();
    drawCategoryHeader(canvas, category.name, base + 8.16);
    base += 25.92;
    drawRow(canvas, category.rows[0], base, columns, final, 0);

    category.rows.slice(1).forEach((row, index) => {
      if (base + ROW_PITCH > LAST_ROW_BASE) {
        nextPage();
        // Pokračování kategorie na nové stránce začíná rovnou řádky.
        base = NEXT_HEADER_LINE + 9.84 - ROW_PITCH;
      }
      base += ROW_PITCH;
      drawRow(canvas, row, base, columns, final, index + 1);
    });
  });

  if (races.length) {
    let line = base + 5.28;
    if (legendBottom(line, races.length) > LAST_ROW_BASE) {
      nextPage();
      line = NEXT_HEADER_LINE + 5.28;
    }
    drawLegend(canvas, races, line);
  }

  drawFooter(canvas);
  return canvas.toDocDefinition({
    title: `${final ? SUBTITLE_FINAL : SUBTITLE_INTERIM} ${standings.season_label || ''}`.trim()
  });
}

