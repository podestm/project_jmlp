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

export const formatSystemRaceNumber = (displayNumber) => (
  displayNumber != null && displayNumber !== '' ? `Sys. ${displayNumber}` : 'Sys. -'
);

export { SET_COLOR_OPTIONS };
