/**
 * Názvy souborů tištěných listin.
 *
 * Jeden tvar pro všechno, ať se listina generuje odkudkoli (Listina, Časy,
 * Výsledky): datum, číslo závodu, druh listiny a případně kategorie.
 *
 *   2026-10-03_JMLP2026-01_startovni-listina-1-kolo.pdf
 *   2026-10-03_JMLP2026-01_vysledky-1-kolo_mysaci-divky.pdf
 *   2026-10-04_JMLP2026-27_prubezne-vysledky-poharu.pdf
 *
 * Bez diakritiky a mezer, ať se soubor dá bez potíží poslat e-mailem
 * i nahrát kamkoli. Datum na začátku řadí soubory ve složce podle data.
 */

/** Úsek názvu: bez diakritiky, malými písmeny, slova spojená pomlčkou. */
export const slug = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const pad = (number) => String(number).padStart(2, '0');

/** YYYY-MM-DD z data závodu ("2026-10-03"), Date, nebo dnešek. */
const isoDay = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Číslo závodu (JMLP2026-01) zůstává, jak je - je to kód, ne slovo. */
const codeOf = (value) =>
  String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * @param {object} parts
 * @param {string|Date} [parts.date]   datum závodu (výchozí dnes)
 * @param {string} [parts.code]        číslo závodu nebo sezóny (JMLP2026-01)
 * @param {string} parts.kind          druh listiny (startovni-listina-1-kolo)
 * @param {string} [parts.category]    název kategorie, když jde o jedinou
 */
export function documentFileName({ date, code, kind, category } = {}) {
  const parts = [isoDay(date), codeOf(code), slug(kind), slug(category)].filter(Boolean);
  return `${parts.join('_')}.pdf`;
}

/** Druhy listin - jedno místo pro jejich názvy. */
export const DOCUMENT_KIND = {
  startList: (round = 1) => `startovni-listina-${round}-kolo`,
  clubList: () => 'rozpis-po-klubech',
  results: (mode = 'final', run = 1) => {
    if (mode === 'run') return `vysledky-${run}-kolo`;
    return mode === 'interim' ? 'prubezne-vysledky' : 'vysledky';
  },
  standings: (final = false) => (final ? 'celkove-vysledky-poharu' : 'prubezne-vysledky-poharu'),
};
