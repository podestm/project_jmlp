/**
 * Prvky společné listinám v podobě z LiZy.
 *
 * Rozměry jsou změřené z PDF, která LiZa vytiskla přes "Microsoft Print to PDF"
 * (startovní listina 2026-01, výsledky 2025-05 a 2024-05). Komentáře u čísel
 * říkají, odkud jsou, aby se dala znovu přeměřit.
 */

/** Světle modrý pás hlavičky a nadpisu. */
export const BAND_BLUE = '#BDDBFF';
/** Žluté linky nad a pod velkým nadpisem. */
export const TITLE_YELLOW = '#FFFF95';
/** Modré hodnoty v rámečcích hlavičky výsledkové listiny. */
export const VALUE_BLUE = '#0000FF';

const FLAG_BLUE = '#0035A6';
const FLAG_RED = '#EF1000';

/** Text patičky. LiZa tu má svůj copyright, listiny z webu se hlásí k jmlp.cz. */
export const FOOTER_TEXT = 'Zpracováno systémem jmlp.cz';

/**
 * Čas jako v LiZe: "30,27", od minuty "01:19,87".
 * @param {number|null} seconds
 */
export function formatTime(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return '';
  const hundredths = Math.round(Number(seconds) * 100);
  const minutes = Math.floor(hundredths / 6000);
  const rest = hundredths - minutes * 6000;
  const secondsPart = `${Math.floor(rest / 100)},${String(rest % 100).padStart(2, '0')}`;
  if (minutes === 0) return secondsPart;
  return `${String(minutes).padStart(2, '0')}:${secondsPart.padStart(5, '0')}`;
}

/** Ztráta na vítěze: "+2,10". */
export function formatDiff(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return '';
  return `+${(Math.round(Number(seconds) * 100) / 100).toFixed(2).replace('.', ',')}`;
}

const parseDate = (isoDate) => {
  if (!isoDate) return null;
  const [year, month, day] = String(isoDate).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const pad2 = (n) => String(n).padStart(2, '0');

/** "03.10.2026" - startovní listina a rozpis. */
export function formatLongDate(isoDate) {
  const date = parseDate(isoDate);
  return date ? `${pad2(date.day)}.${pad2(date.month)}.${date.year}` : '';
}

/** "07.02.26" - výsledková listina (za datem následuje místo). */
export function formatShortDate(isoDate) {
  const date = parseDate(isoDate);
  return date ? `${pad2(date.day)}.${pad2(date.month)}.${String(date.year).slice(-2)}` : '';
}

/** "Jihomoravský lyžařský pohár - XX.ročník" */
export function cupTitle(header) {
  const name = header?.cupName || 'Jihomoravský lyžařský pohár';
  return header?.editionLabel ? `${name} - ${header.editionLabel}ročník` : name;
}

/** Česká vlajka vepsaná do obdélníku - LiZa ji tiskne jako roztaženou bitmapu. */
export function drawFlag(canvas, x1, top, x2, bottom) {
  // Tvary jdou rovnou do plátna, tak i s jeho tiskovým okrajem (PdfCanvas.offsetY).
  const y1 = top + canvas.offsetY;
  const y2 = bottom + canvas.offsetY;
  const w = x2 - x1;
  const h = y2 - y1;
  const tip = x1 + w * 0.48;
  canvas.items.push({
    canvas: [
      { type: 'rect', x: x1, y: y1, w, h: h / 2, color: '#FFFFFF', lineWidth: 0 },
      { type: 'rect', x: x1, y: y1 + h / 2, w, h: h / 2, color: FLAG_RED, lineWidth: 0 },
      {
        type: 'polyline',
        closePath: true,
        color: FLAG_BLUE,
        lineWidth: 0,
        points: [
          { x: x1, y: y1 },
          { x: tip, y: y1 + h / 2 },
          { x: x1, y: y2 },
        ],
      },
    ],
    absolutePosition: { x: 0, y: 0 },
  });
}

/**
 * Logo vepsané do šířky rámečku na bílém podkladu - v LiZe mají loga bílé
 * pozadí, na modrém pásu je tedy vidět bílý obdélník.
 *
 * @param {{dataUrl: string, width: number, height: number}|null} logo
 */
export function drawLogo(canvas, logo, x, y, maxWidth, maxHeight) {
  if (!logo?.dataUrl) return;
  const ratio = logo.width && logo.height ? logo.width / logo.height : maxWidth / maxHeight;
  let width = maxWidth;
  let height = width / ratio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }
  canvas.rect(x, y, x + width, y + height, { fill: '#FFFFFF' });
  canvas.image(logo.dataUrl, x, y, x + width, y + height);
}

/**
 * Pruh s logy sponzorů na konci listiny, mezi dvěma linkami. Bez obrázku
 * zůstane mezi linkami prázdné místo - LiZa ho tiskne i u startovní listiny.
 */
export function drawSponsors(
  canvas,
  sponsors,
  lastRowBottom,
  { lineFrom = 17.28, lineTo = 537.84, gap = 79.2 } = {},
) {
  const top = lastRowBottom + 0.72;
  canvas.line(lineFrom, top, lineTo, top);
  if (sponsors?.dataUrl) {
    const maxWidth = 540.72;
    const maxHeight = gap - 2;
    const ratio =
      sponsors.width && sponsors.height ? sponsors.width / sponsors.height : maxWidth / maxHeight;
    let width = maxWidth;
    let height = width / ratio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio;
    }
    const x = 15.12 + (maxWidth - width) / 2;
    canvas.image(sponsors.dataUrl, x, top, x + width, top + height);
  }
  canvas.line(lineFrom, lastRowBottom + gap, lineTo, lastRowBottom + gap);
}
