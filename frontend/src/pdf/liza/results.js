/**
 * Výsledková listina v podobě z LiZy.
 *
 * Předlohy: 2025-05-Vysledky.pdf (LiZa 3.12.001, jedno kolo), dvoukolový
 * závod 2024-05 (LiZa 3.10) a výsledkové listiny jednotlivých kol z LiZy.
 * A4 na výšku; na první stránce velká hlavička se činovníky a údaji o kolech,
 * na dalších jen pás s nadpisem a hlavičkou sloupců.
 *
 * Tři podoby:
 *  - celková listina (CELKOVÁ VÝSLEDKOVÁ LISTINA) - časy kol, součet, ztráta, body,
 *  - listina kola: 1.KOLA jen s časem 1. kola, 2.KOLA rozepsaná i sečtená
 *    (oba časy, součet, ztráta) - bez bodů,
 *  - průběžná listina během závodu - bez hlavičky závodu.
 */
import { A4_PORTRAIT, PdfCanvas } from './layout.js';
import {
  BAND_BLUE,
  FOOTER_TEXT,
  TITLE_YELLOW,
  VALUE_BLUE,
  cupTitle,
  drawFlag,
  drawLogo,
  formatDiff,
  formatShortDate,
  formatTime
} from './common.js';

/** runMode celkové listiny (vedle '1' a '2' pro jednotlivá kola). */
export const RUN_MODE_SUM = 'sum';

export const TITLE_FINAL = 'CELKOVÁ VÝSLEDKOVÁ LISTINA';
export const TITLE_INTERIM = 'PRŮBĚŽNÁ VÝSLEDKOVÁ LISTINA';
export const titleForRun = (run) => `VÝSLEDKOVÁ LISTINA ${run}.KOLA`;

const ROW_HEIGHT = 20.16;
const CATEGORY_HEIGHT = 22.32;
/** Spodek posledního řádku na stránce smí být nejvýš tady (LiZa pustí ještě 812,88). */
const PAGE_BOTTOM = 813.0;
const FIRST_BAND_TOP = 261.36;
const NEXT_BAND_TOP = 0;

const BOLD8 = { size: 8.04, bold: true };
const BOLD10 = { size: 9.96, bold: true };
const REGULAR8 = { size: 8.04 };
const VALUE = { size: 9.96, bold: true, color: VALUE_BLUE, align: 'center' };

const LABEL_RIGHT = 158.42;
const LEFT_BOX = [164.16, 315.36];
const RIGHT_BOX = [333.36, 484.56];

/** Řádek hlavičky: popisek vlevo, bílý rámeček a modrá hodnota (pro 1. a případně 2. kolo). */
/** Šířky popisků v LiZe (viz fitWidth v layout.js) a pravý okraj, kam je LiZa zarovnává. */
const LABELS = {
  'ŘEDITEL ZÁVODU': { width: 70.05, right: 159.93 },
  TD: { width: 10.63, right: 158.47 },
  'HLAVNÍ ČASOMĚŘIČ': { width: 80.05, right: 158.41 },
  'STAVITEL TRATI': { width: 61.74, right: 158.34 },
  BRANEK: { width: 33.88, right: 158.44 },
  PODMÍNKY: { width: 43.36, right: 158.44 },
  'ČAS STARTU': { width: 50.18, right: 158.42 },
  'DÉLKA TRATI': { width: 51.69, right: 158.37 }
};

function headerRow(canvas, { label, labelBase, boxTop, boxBottom, valueBase, values, wide = false }) {
  const measured = LABELS[label] || { right: LABEL_RIGHT };
  canvas.text(label, measured.right, labelBase, { ...BOLD8, align: 'right', fitWidth: measured.width });
  if (wide) {
    canvas.rect(LEFT_BOX[0], boxTop, RIGHT_BOX[1], boxBottom, { fill: '#FFFFFF' });
    canvas.text(values[0] || '', (LEFT_BOX[0] + RIGHT_BOX[1]) / 2, valueBase, { ...VALUE, maxWidth: 316 });
    return;
  }
  canvas.rect(LEFT_BOX[0], boxTop, LEFT_BOX[1], boxBottom, { fill: '#FFFFFF' });
  canvas.text(values[0] || '', (LEFT_BOX[0] + LEFT_BOX[1]) / 2, valueBase, { ...VALUE, maxWidth: 148 });
  if (values.length > 1) {
    canvas.rect(RIGHT_BOX[0], boxTop, RIGHT_BOX[1], boxBottom, { fill: '#FFFFFF' });
    canvas.text(values[1] || '', (RIGHT_BOX[0] + RIGHT_BOX[1]) / 2, valueBase, { ...VALUE, maxWidth: 148 });
  }
}

const runValue = (run, key) => {
  const value = run?.[key];
  return value === null || value === undefined ? '' : String(value);
};

function drawRaceHeader(canvas, header, runCount) {
  canvas.rect(16.56, 16.56, 556.56, 250.56, { fill: BAND_BLUE });
  canvas.rect(16.92, 16.92, 556.08, 250.08, { stroke: BAND_BLUE, width: 0.72 });
  drawLogo(canvas, header.leftLogo, 22.32, 22.32, 83.52, 70);
  drawLogo(canvas, header.rightLogo, 467.28, 22.32, 68.16, 69.84);
  canvas.text(cupTitle(header), 287.59, 45.36, { size: 17.04, bold: true, align: 'center' });

  canvas.text('ČÍSLO ZÁVODU:', 315.26, 89.52, { ...BOLD8, align: 'right', fitWidth: 63.02 });
  canvas.rect(333.36, 77.76, 458.64, 97.2, { fill: '#FFFFFF' });
  canvas.text(header.raceNumberLabel || '', 396.0, 92.4, { size: 14.04, bold: true, align: 'center', maxWidth: 124 });

  canvas.rect(333.36, 102.24, 531.36, 121.68, { fill: '#FFFFFF' });
  canvas.text(header.organizerName || '', 432.36, 116.88, { size: 14.04, bold: true, align: 'center', maxWidth: 196 });
  canvas.rect(333.36, 127.44, 531.36, 146.88, { fill: '#FFFFFF' });
  const datePlace = [formatShortDate(header.raceDate), header.arealName].filter(Boolean).join(' ');
  canvas.text(datePlace, 432.36, 141.36, { size: 12, bold: true, align: 'center', maxWidth: 196 });

  headerRow(canvas, { label: 'ŘEDITEL ZÁVODU', labelBase: 111.12, boxTop: 102.24, boxBottom: 114.48, valueBase: 111.84, values: [header.raceDirector] });
  headerRow(canvas, { label: 'TD', labelBase: 126.96, boxTop: 118.08, boxBottom: 130.32, valueBase: 127.68, values: [header.technicalDelegate] });
  headerRow(canvas, { label: 'HLAVNÍ ČASOMĚŘIČ', labelBase: 142.8, boxTop: 133.92, boxBottom: 146.16, valueBase: 143.52, values: [header.chiefTimekeeper] });

  const runs = [1, 2].slice(0, runCount).map((number) => (
    (header.runs || []).find((run) => Number(run.run_number) === number) || {}
  ));
  canvas.text('1.KOLO', 243.71, 162.24, { ...BOLD10, align: 'center' });
  if (runCount > 1) canvas.text('2.KOLO', 411.47, 163.68, { ...BOLD10, align: 'center' });

  const perRun = (key, suffix = '') => runs.map((run) => {
    const value = runValue(run, key);
    return value ? `${value}${suffix}` : '';
  });
  headerRow(canvas, { label: 'STAVITEL TRATI', labelBase: 175.92, boxTop: 165.6, boxBottom: 177.84, valueBase: 175.2, values: perRun('course_setter') });
  headerRow(canvas, { label: 'BRANEK', labelBase: 191.76, boxTop: 182.16, boxBottom: 194.4, valueBase: 191.76, values: perRun('gates_count') });
  headerRow(canvas, { label: 'PODMÍNKY', labelBase: 207.6, boxTop: 199.44, boxBottom: 211.68, valueBase: 209.04, values: perRun('conditions') });
  headerRow(canvas, { label: 'ČAS STARTU', labelBase: 223.44, boxTop: 216.0, boxBottom: 228.24, valueBase: 225.6, values: perRun('start_time') });
  // Délka trati je v LiZe jedna pro celý závod.
  const length = perRun('course_length_m', 'm').find(Boolean) || '';
  headerRow(canvas, { label: 'DÉLKA TRATI', labelBase: 239.28, boxTop: 232.56, boxBottom: 244.8, valueBase: 242.16, values: [length], wide: true });
}

function drawTitleBand(canvas, top, title, { runCount, showPoints }) {
  canvas.rect(16.56, top, 556.56, top + 60.48, { fill: BAND_BLUE });
  canvas.rect(16.92, top + 0.36, 556.08, top + 60.0, { stroke: BAND_BLUE, width: 0.72 });
  canvas.line(20.16, top + 6.48, 551.52, top + 6.48, { width: 3.6, color: TITLE_YELLOW });
  canvas.line(20.16, top + 39.6, 551.52, top + 39.6, { width: 3.6, color: TITLE_YELLOW });
  canvas.text(title, 286.31, top + 32.64, { size: 24, bold: true, align: 'center' });

  const base = top + 55.32;
  canvas.text('Pořadí', 16.56, base, BOLD10);
  canvas.text('Jméno', 53.97, base, BOLD10);
  canvas.text('st.č. ročník', 132.96, top + 55.2, { size: 9.96 });
  canvas.text('Startuje za', 190.8, base, BOLD10);
  canvas.text('Stát', 314.17, base, BOLD10);
  canvas.text('1.kolo', 357.1, base, BOLD10);
  if (runCount > 1) canvas.text('2.kolo', 396.76, base, BOLD10);
  canvas.text('Součet', 451.34, base, BOLD10);
  canvas.text('DIF', 499.72, base, BOLD10);
  if (showPoints) canvas.text('PT', 534.4, base, BOLD10);

  canvas.line(18.0, top + 60.48, 554.4, top + 60.48, { width: 2.16 });
  return top + 62.64;
}

/** Za kolik minut po vygenerování se listina kola vyvěsí (domluveno s provozem). */
export const POSTING_DELAY_MINUTES = 2;

/**
 * Čas vyvěšení listiny kola: čas vygenerování + 2 minuty, "10:44".
 * Od vyvěšení běží lhůta na protesty (Pokyny pro pořadatele), LiZa ho netiskla.
 */
export function postingTime(now = new Date()) {
  const posted = new Date(now.getTime() + POSTING_DELAY_MINUTES * 60 * 1000);
  return `${String(posted.getHours()).padStart(2, '0')}:${String(posted.getMinutes()).padStart(2, '0')}`;
}

function drawFooter(canvas, { posted = null } = {}) {
  canvas.line(17.28, 814.32, 537.84, 814.32);
  canvas.line(18.0, 828.0, 538.56, 828.0);
  canvas.text(FOOTER_TEXT, 20.88, 823.8, REGULAR8);
  // Uprostřed spodní lišty, mezi patičkou a číslem strany.
  if (posted) canvas.text(`Čas vyvěšení: ${posted}`, 277.56, 823.8, { ...BOLD8, align: 'center' });
  canvas.text('Strana:', 462.96, 823.8, REGULAR8);
  canvas.text(String(canvas.pageNumber), 514.08, 823.8, REGULAR8);
}

/** Pořadí jako v LiZe: zarovnané na tři znaky mezerami a celé vystředěné. */
const rankLabel = (rank) => String(rank).padStart(3, ' ');

function drawEntry(canvas, entry, bottom, { runCount, mode, run }) {
  canvas.line(18.72, bottom, 547.92, bottom);

  if (entry.rank != null) {
    canvas.text(rankLabel(entry.rank), 28.77, bottom - 7.32, { ...BOLD10, align: 'center' });
  } else if (entry.status) {
    canvas.text(entry.status, 18.0, bottom - 7.32, BOLD10);
  }

  canvas.text(entry.surname || '', 52.56, bottom - 10.92, { ...BOLD10, maxWidth: 136 });
  canvas.text(entry.firstName || '', 51.12, bottom - 2.04, { ...REGULAR8, maxWidth: 95 });
  if (entry.bib != null) canvas.text(String(entry.bib), 157.0, bottom - 0.6, { ...REGULAR8, align: 'right' });
  if (entry.year != null) canvas.text(String(entry.year), 163.68, bottom - 0.6, REGULAR8);
  canvas.text(entry.slcrId || '', 189.36, bottom - 0.6, { ...REGULAR8, maxWidth: 100 });
  canvas.text(entry.club || '', 190.08, bottom - 11.76, { ...REGULAR8, maxWidth: 118 });

  drawFlag(canvas, 310.32, bottom - 15.12, 327.6, bottom - 2.88);
  canvas.rect(309.96, bottom - 15.48, 327.84, bottom - 2.64, { stroke: '#000000', width: 0.72 });
  canvas.text(entry.nation || 'CZE', 331.2, bottom - 8.16, REGULAR8);

  // Se stavem (DSQ, DNF, DNS) se netiskne žádný čas - ani z kola, které
  // závodník dojel. Tak to tiskne LiZa a stejně to ukazuje tabulka výsledků.
  if (entry.status) return;

  // Listina 1. kola má jen čas 1. kola. Listina 2. kola je rozepsaná
  // i sečtená (oba časy, součet, ztráta) - jen bez bodů, ty patří celkové.
  const firstRunOnly = mode === 'run' && run === 1;
  canvas.text(formatTime(entry.time1), 384.52, bottom - 8.4, { ...REGULAR8, align: 'right' });
  if (runCount > 1 && !firstRunOnly) canvas.text(formatTime(entry.time2), 427.0, bottom - 8.16, { ...REGULAR8, align: 'right' });

  if (firstRunOnly) return;
  if (entry.rank != null) {
    canvas.text(formatTime(entry.total), 481.66, bottom - 7.32, { ...BOLD10, align: 'right' });
    if (entry.diff != null && entry.rank !== 1) canvas.text(formatDiff(entry.diff), 493.92, bottom - 8.16, REGULAR8);
    if (entry.points && mode !== 'run') canvas.text(String(entry.points), 547.92, bottom - 8.52, { ...REGULAR8, align: 'right' });
  }
}

/** Pruh sponzorů pod posledním řádkem - mezi dvěma linkami, jako v LiZe. */
function drawSponsors(canvas, sponsors, lastRowBottom) {
  const top = lastRowBottom + 0.72;
  canvas.line(17.28, top, 545.04, top);
  if (sponsors?.dataUrl) {
    const maxWidth = 540.72;
    const maxHeight = 77.76;
    const ratio = sponsors.width && sponsors.height ? sponsors.width / sponsors.height : maxWidth / maxHeight;
    let width = maxWidth;
    let height = width / ratio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio;
    }
    const x = 15.12 + (maxWidth - width) / 2;
    canvas.image(sponsors.dataUrl, x, top, x + width, top + height);
  }
  canvas.line(17.28, lastRowBottom + 80.64, 554.4, lastRowBottom + 80.64);
}

/**
 * @param {object} options
 * @param {object|null} options.header  hlavička závodu; null = průběžná listina bez hlavičky
 * @param {number} [options.runCount=1] počet kol závodu (1 nebo 2)
 * @param {'final'|'run'|'interim'} [options.mode='final']
 * @param {number} [options.run]        u mode 'run' číslo kola
 * @param {Array}  options.categories   [{ name, entries: [{ rank, status, surname, firstName,
 *                                       bib, year, slcrId, club, nation, time1, time2,
 *                                       total, diff, points }] }] už seřazené
 * @param {string} [options.posted]     čas vyvěšení ("10:44") - tiskne se ve spodní liště listiny kola
 */
export function buildResultsDoc({ header = null, runCount = 1, mode = 'final', run = 1, categories = [], posted = null }) {
  const canvas = new PdfCanvas(A4_PORTRAIT);
  const runs = Math.min(Math.max(Number(runCount) || 1, 1), 2);
  const title = mode === 'run' ? titleForRun(run) : (mode === 'interim' ? TITLE_INTERIM : TITLE_FINAL);
  const options = { runCount: runs, showPoints: mode !== 'run', mode, run: Number(run) };

  let y;
  if (header && mode !== 'interim') {
    drawRaceHeader(canvas, header, runs);
    y = drawTitleBand(canvas, FIRST_BAND_TOP, title, options);
  } else {
    y = drawTitleBand(canvas, NEXT_BAND_TOP, title, options);
  }

  // Čas vyvěšení patří listině kola, od něj běží lhůta na protesty.
  const footer = { posted: mode === 'run' ? posted : null };
  const nextPage = () => {
    drawFooter(canvas, footer);
    canvas.newPage();
    y = drawTitleBand(canvas, NEXT_BAND_TOP, title, options);
  };

  categories.forEach((category) => {
    const entries = category.entries || [];
    if (entries.length === 0) return;
    // LiZa nadpis kategorie s prvním závodníkem nesvazuje - nadpis klidně
    // zůstane posledním řádkem stránky a závodníci pokračují na další.
    if (y + CATEGORY_HEIGHT > PAGE_BOTTOM) nextPage();
    canvas.text(category.name || '', 23.76, y + 19.8, { size: 12, bold: true });
    y += CATEGORY_HEIGHT;

    entries.forEach((entry) => {
      if (y + ROW_HEIGHT > PAGE_BOTTOM) nextPage();
      y += ROW_HEIGHT;
      drawEntry(canvas, entry, y, options);
    });
  });

  if (y + 80.64 > 812) nextPage();
  drawSponsors(canvas, header?.sponsors, y);
  drawFooter(canvas, footer);

  return canvas.toDocDefinition({ title });
}

