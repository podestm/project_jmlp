/**
 * Rozpis startujících po klubech ("Seznam startujících podle oddílu")
 * v podobě z LiZy.
 *
 * Předloha: RozpisKluby_2026-01-Kohoutovice.pdf (LiZa 3.12.001, A4 na výšku).
 * Bez patičky a téměř bez okrajů - LiZa tuhle sestavu tiskne od horní hrany
 * stránky. Na konci je na samostatné stránce seznam sad startovních čísel
 * a seznam kategorií s jejich zkratkami.
 */
import { A4_PORTRAIT, PdfCanvas } from './layout.js';
import { cupTitle, formatLongDate } from './common.js';

const ROW_HEIGHT = 13.68;
const CLUB_HEIGHT = 18.0;
const FIRST_PAGE_TOP = 43.8;
const NEXT_PAGE_TOP = -1.56;
const PAGE_BOTTOM = A4_PORTRAIT.height;

const SET_NAMES = [
  'První',
  'Druhá',
  'Třetí',
  'Čtvrtá',
  'Pátá',
  'Šestá',
  'Sedmá',
  'Osmá',
  'Devátá',
  'Desátá',
];

/** "První sada", "Druhá sada" ... - LiZa sady pojmenovává řadovou číslovkou. */
export const setName = (number) => `${SET_NAMES[number - 1] || `${number}.`} sada`;

/**
 * Zkratka kategorie jako v LiZe (MYD, PPH, MZD, OZ ...).
 *
 * Odvozuje se z názvu kategorie a pohlaví: věková skupina + D/H, u OPEN Z/M.
 * @param {string} name   název kategorie
 * @param {number|string|null} sex  1 = muži, 2 = ženy (jako fuj_jmlp_category.sex)
 */
export function categoryCode(name, sex) {
  const lower = String(name || '').toLocaleLowerCase('cs');
  const female = Number(sex) === 2 || (sex == null && /dívk|žačk|juniork|žen|dívky/.test(lower));
  if (lower.includes('open')) return female ? 'OZ' : 'OM';
  let group = null;
  if (lower.includes('myš')) group = 'MY';
  else if (lower.includes('přípravk')) group = 'PP';
  else if (lower.includes('předž')) group = 'P';
  else if (lower.includes('mladš')) group = 'MZ';
  else if (lower.includes('starš')) group = 'SZ';
  else if (lower.includes('junio')) group = 'JU';
  if (group) return `${group}${female ? 'D' : 'H'}`;
  // Neznámá kategorie: počáteční písmena slov, ať tam aspoň něco smysluplného je.
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .join('')
    .slice(0, 4);
}

/** Řazení klubů jako v LiZe - podle kódů znaků, tedy velká písmena první. */
const ordinalCompare = (a, b) => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

/**
 * Seskupí startující po klubech.
 * @param {Array} entries [{ club, bib, setNumber, sex, surname, firstName, year, categoryCode }]
 */
export function groupByClub(entries) {
  const clubs = new Map();
  entries.forEach((entry) => {
    const name = entry.club || '-';
    if (!clubs.has(name)) clubs.set(name, []);
    clubs.get(name).push(entry);
  });
  return [...clubs.entries()]
    .sort(([a], [b]) => ordinalCompare(a, b))
    .map(([name, list]) => ({
      name,
      entries: [...list].sort((a, b) => (a.bib ?? Infinity) - (b.bib ?? Infinity)),
    }));
}

/**
 * @param {object} options
 * @param {object} options.header      { cupName, editionLabel, raceNumberLabel, raceDate }
 * @param {Array}  options.entries     startující (viz groupByClub)
 * @param {Array}  options.sets        [{ number }] sady startovních čísel
 * @param {Array}  options.categories  [{ code, name }] kategorie závodu v pořadí
 */
export function buildClubListDoc({ header = {}, entries = [], sets = [], categories = [] }) {
  const canvas = new PdfCanvas(A4_PORTRAIT);

  const bold14 = { size: 14.04, bold: true };
  const bold12 = { size: 12, bold: true };
  canvas.text('Seznam startujících ', 20.16, 15.12, bold14);
  canvas.text('podle oddílu', 20.16, 31.68, bold14);
  canvas.text(cupTitle(header), 209.52, 14.64, bold12);
  canvas.text(formatLongDate(header.raceDate), 209.52, 34.92, bold12);
  canvas.text(header.raceNumberLabel || '', 527.69, 34.92, { ...bold12, align: 'right' });

  let y = FIRST_PAGE_TOP;
  const ensure = (height) => {
    if (y + height > canvas.limit(PAGE_BOTTOM)) {
      canvas.newPage();
      y = NEXT_PAGE_TOP;
    }
  };

  groupByClub(entries).forEach((club) => {
    ensure(CLUB_HEIGHT);
    const clubBase = y + 15.12;
    canvas.text(club.name, 20.16, clubBase, { size: 9.96, bold: true, maxWidth: 198 });
    canvas.line(221.76, clubBase - 4.2, 526.32, clubBase - 4.2, { width: 0.38 });
    y += CLUB_HEIGHT;

    club.entries.forEach((entry) => {
      ensure(ROW_HEIGHT);
      const base = y + 12.24;
      const small = { size: 8.04 };
      if (entry.setNumber != null) canvas.text(String(entry.setNumber), 23.64, base - 1.92, small);
      if (entry.bib != null)
        canvas.text(String(entry.bib), 34.56, base, { size: 9.96, bold: true });
      const sexLetter = Number(entry.sex) === 2 ? 'Z' : 'M';
      canvas.text(
        `${sexLetter} - ${entry.surname || ''} ${entry.firstName || ''}`.trimEnd(),
        61.92,
        base - 0.12,
        { size: 9.96, maxWidth: 300 },
      );
      canvas.text(entry.year != null ? String(entry.year) : '', 385.23, base - 1.92, {
        ...small,
        align: 'right',
      });
      canvas.text(entry.categoryCode || '', 395.28, base - 1.92, small);
      y += ROW_HEIGHT;
    });
  });

  // Seznam sad a kategorií vždy na nové stránce.
  canvas.newPage();
  const small = { size: 8.04 };
  canvas.line(14.4, 2.16, 324.0, 2.16);
  canvas.text('SEZNAM SAD STARTOVNÍCH ČÍSEL', 28.8, 11.52, small);
  canvas.line(14.4, 16.56, 324.0, 16.56);
  let base = 25.32;
  sets.forEach((set) => {
    canvas.text(String(set.number), 28.76, base, { ...small, align: 'center' });
    canvas.text(set.name || setName(set.number), 50.4, base, small);
    base += 11.52;
  });
  const titleBase = base - 11.52 + 12.84;
  canvas.text('Seznam kategorií', 10.8, titleBase, small);
  canvas.line(5.76, titleBase + 5.76, 504.72, titleBase + 5.76, { width: 0.38 });
  let categoryBase = titleBase + 16.68;
  categories.forEach((category) => {
    canvas.text(category.code || '', 14.4, categoryBase, small);
    canvas.text(category.name || '', 50.4, categoryBase, small);
    categoryBase += 9.36;
  });

  return canvas.toDocDefinition({ title: 'Seznam startujících podle oddílu' });
}
