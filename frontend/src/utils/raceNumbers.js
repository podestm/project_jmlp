// Sady startovních čísel mají skutečné barvy dresů (tokeny --ms-bib-*,
// components/ms/tokens.js). `solid` je hodnota CSS barvy sady.
import { bibVar } from '../components/ms/tokens.js';

const bib = (value, label) => {
  return { value, label, solid: `var(${bibVar(value)})` };
};

const SET_COLOR_OPTIONS = [
  bib('rose', 'Růžová'),
  bib('blue', 'Modrá'),
  bib('emerald', 'Zelená'),
  bib('amber', 'Oranžová'),
  bib('violet', 'Fialová'),
];

const DEFAULT_THEME = SET_COLOR_OPTIONS[0];

export const getSetColorTheme = (setColor) => (
  SET_COLOR_OPTIONS.find((option) => option.value === setColor) || DEFAULT_THEME
);

/** Barva sady jako hodnota CSS (var(--ms-bib-…)); neznámá sada = výchozí. */
export const setColorVar = (setColor) => getSetColorTheme(setColor).solid;

/**
 * Systémové označení čísla: písmeno sady + číslo dresu ("B12" = dres 12
 * ze sady 2). Ukládá ho server (display_number / race_number_display).
 */
export const formatSystemRaceNumber = (displayNumber) => (
  displayNumber != null && displayNumber !== '' ? String(displayNumber) : ''
);

const RACE_NUMBER_CODE = /^([A-Z])(\d{1,4})$/;

/** Písmeno sady pro systémové označení: sada 1 = A, 2 = B ... (nejvýš 26). */
export const setLetter = (setNumber) => {
  const n = parseInt(setNumber, 10);
  return n >= 1 && n <= 26 ? String.fromCharCode(64 + n) : '?';
};

/** "b 12" -> "B12"; prázdné -> ''; jiný tvar vrátí, jak je (validace ho odmítne). */
export const normalizeRaceNumberCode = (value) => {
  const text = String(value ?? '').replace(/\s+/g, '').toUpperCase();
  const match = RACE_NUMBER_CODE.exec(text);
  return match ? `${match[1]}${Number(match[2])}` : text;
};

export const isRaceNumberCode = (value) => RACE_NUMBER_CODE.test(normalizeRaceNumberCode(value));

/** Řazení A1, A2 ... A200, B1 (ne podle textu, kde je A10 před A2). */
export const compareRaceNumberCodes = (a, b) => {
  const left = RACE_NUMBER_CODE.exec(normalizeRaceNumberCode(a));
  const right = RACE_NUMBER_CODE.exec(normalizeRaceNumberCode(b));
  if (!left || !right) return left ? -1 : right ? 1 : 0;
  return left[1].localeCompare(right[1]) || Number(left[2]) - Number(right[2]);
};

export { SET_COLOR_OPTIONS };
