/**
 * Startovní listina kola v podobě z LiZy.
 *
 * Předloha: Startlist_2026-01-Kohoutovice.pdf (LiZa 3.12.001, A4 na výšku).
 * Na první stránce je hlavička závodu, na dalších jen pás s nadpisem
 * a hlavičkou sloupců. Kategorie jdou za sebou, řádek závodníka má 20,16 b.
 */
import { A4_PORTRAIT, PdfCanvas } from './layout.js';
import {
  BAND_BLUE,
  FOOTER_TEXT,
  TITLE_YELLOW,
  cupTitle,
  drawFlag,
  drawLogo,
  drawSponsors,
  formatLongDate
} from './common.js';

const ROW_HEIGHT = 20.16;
const CATEGORY_HEIGHT = 13.68;
/** Nejnižší povolený spodek řádku - pod ním je patička (linka na 814,32). */
const PAGE_BOTTOM = 812;
const FIRST_BAND_TOP = 126.0;
const NEXT_BAND_TOP = 5.76;

const BOLD8 = { size: 8.04, bold: true };
const BOLD10 = { size: 9.96, bold: true };
const REGULAR8 = { size: 8.04 };

function drawRaceHeader(canvas, header) {
  canvas.rect(10.8, 15.84, 550.8, 119.52, { fill: BAND_BLUE });
  canvas.rect(11.16, 16.2, 550.32, 119.04, { stroke: BAND_BLUE, width: 0.72 });
  drawLogo(canvas, header.leftLogo, 17.28, 24.48, 71.28, 88);
  drawLogo(canvas, header.rightLogo, 472.32, 24.48, 68.16, 69.84);
  canvas.text(cupTitle(header), 285.84, 39.6, { size: 17.04, bold: true, align: 'center' });

  canvas.rect(100.8, 74.16, 308.16, 90.72, { fill: '#FFFFFF' });
  canvas.rect(331.92, 74.16, 457.92, 90.72, { fill: '#FFFFFF' });
  canvas.rect(100.8, 94.32, 308.16, 110.88, { fill: '#FFFFFF' });
  canvas.rect(331.92, 94.32, 457.92, 110.88, { fill: '#FFFFFF' });

  const big = { size: 14.04, bold: true };
  canvas.text('ČÍSLO ZÁVODU:', 308.33, 87.36, { ...big, align: 'right' });
  canvas.text(header.raceNumberLabel || '', 394.92, 87.36, { ...big, align: 'center', maxWidth: 124 });
  canvas.text(header.organizerName || '', 100.8, 107.52, { ...big, maxWidth: 206 });
  canvas.text(formatLongDate(header.raceDate), 394.92, 107.52, { ...big, align: 'center', maxWidth: 124 });
}

/** Modrý pás s nadpisem a hlavičkou sloupců; vrací horní hranu obsahu. */
function drawTitleBand(canvas, top, title) {
  canvas.rect(10.8, top, 550.8, top + 60.48, { fill: BAND_BLUE });
  canvas.rect(11.16, top + 0.36, 550.32, top + 60.0, { stroke: BAND_BLUE, width: 0.72 });
  canvas.line(16.56, top + 6.48, 537.12, top + 6.48, { width: 3.6, color: TITLE_YELLOW });
  canvas.line(18.72, top + 39.6, 539.28, top + 39.6, { width: 3.6, color: TITLE_YELLOW });
  canvas.text(title, 279.42, top + 32.64, { size: 24, bold: true, align: 'center' });

  canvas.text('Pořadí/st.číslo', 15.24, top + 54.6, BOLD8);
  const headerBase = top + 55.32;
  canvas.text('Body', 79.2, headerBase, BOLD10);
  canvas.text('Jméno', 126.04, headerBase, BOLD10);
  canvas.text('Startuje za', 257.78, headerBase, BOLD10);
  canvas.text('Stát', 414.22, headerBase, BOLD10);
  canvas.text('Ročník', 460.0, headerBase, BOLD10);

  canvas.line(10.8, top + 60.48, 550.8, top + 60.48, { width: 2.16 });
  return top + 62.64;
}

function drawFooter(canvas) {
  canvas.line(17.28, 814.32, 537.84, 814.32);
  canvas.line(18.0, 828.0, 538.56, 828.0);
  canvas.text(FOOTER_TEXT, 20.88, 823.8, { size: 8.04, serif: true });
  canvas.text('Strana:', 509.71, 823.8, { ...REGULAR8, align: 'right' });
  canvas.text(String(canvas.pageNumber), 514.08, 823.8, REGULAR8);
}

function drawEntry(canvas, entry, bottom) {
  canvas.line(12.96, bottom, 542.16, bottom);
  if (entry.number != null) {
    // LiZa číslo odsazuje čtyřmi mezerami a celé to centruje.
    canvas.text(`    ${entry.number}`, 36.35, bottom - 6.96, { ...BOLD8, align: 'center' });
  }
  canvas.text(entry.slcrId || '', 79.2, bottom - 2.64, { ...REGULAR8, maxWidth: 46 });
  canvas.text(entry.surname || '', 126.72, bottom - 10.92, { ...BOLD10, maxWidth: 128 });
  canvas.text(entry.firstName || '', 126.72, bottom - 2.04, { ...REGULAR8, maxWidth: 128 });
  canvas.text(entry.club || '', 257.76, bottom - 7.44, { ...REGULAR8, maxWidth: 154 });
  drawFlag(canvas, 414.0, bottom - 15.84, 432.72, bottom - 5.76);
  canvas.text(entry.nation || 'CZE', 435.6, bottom - 8.16, REGULAR8);
  canvas.text(entry.year != null ? String(entry.year) : '', 495.39, bottom - 8.16, { ...REGULAR8, align: 'right' });
}

/**
 * @param {object} options
 * @param {object} options.header      hlavička závodu (viz useRacePdf)
 * @param {number} [options.round=1]   kolo - jen do nadpisu
 * @param {Array}  options.categories  [{ name, entries: [{ number, slcrId, surname,
 *                                      firstName, club, nation, year }] }] v pořadí startu
 */
export function buildStartListDoc({ header = {}, round = 1, categories = [] }) {
  const canvas = new PdfCanvas(A4_PORTRAIT);
  const title = `STARTOVNÍ LISTINA ${round}. KOLA`;

  drawRaceHeader(canvas, header);
  let y = drawTitleBand(canvas, FIRST_BAND_TOP, title);

  const nextPage = () => {
    drawFooter(canvas);
    canvas.newPage();
    y = drawTitleBand(canvas, NEXT_BAND_TOP, title);
  };

  categories.forEach((category) => {
    const entries = category.entries || [];
    if (entries.length === 0) return;
    // Jako v LiZe: nadpis kategorie smí zůstat posledním řádkem stránky.
    if (y + CATEGORY_HEIGHT > PAGE_BOTTOM) nextPage();
    canvas.text(category.name || '', 17.28, y + 11.04, BOLD10);
    y += CATEGORY_HEIGHT;

    entries.forEach((entry) => {
      if (y + ROW_HEIGHT > PAGE_BOTTOM) nextPage();
      y += ROW_HEIGHT;
      drawEntry(canvas, entry, y);
    });
  });

  if (y + 79.2 > PAGE_BOTTOM) nextPage();
  drawSponsors(canvas, null, y);
  drawFooter(canvas);

  return canvas.toDocDefinition({ title });
}

export const startListFileName = (raceNumberLabel, round = 1) =>
  `startovni-listina-${round}-kolo${raceNumberLabel ? `-${raceNumberLabel}` : ''}.pdf`;
