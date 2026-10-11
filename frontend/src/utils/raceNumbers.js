// Sady startovních čísel mají skutečné barvy dresů (tokeny --ms-bib-*,
// components/ms/tokens.js). `solid` nese bílé číslo, `soft` a `border` jsou
// z téže barvy namíchané s průhlednou – pro podklad a rámeček.
import { bibVar } from '../components/ms/tokens.js';

const bib = (value, label) => {
  const solid = `var(${bibVar(value)})`;
  return {
    value,
    label,
    solid,
    soft: `color-mix(in srgb, ${solid} 10%, transparent)`,
    border: `color-mix(in srgb, ${solid} 35%, transparent)`,
  };
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

/** Inline vzhled odznaku čísla pro nepřevedené obrazovky (Live, schránka impulzů). */
export const getRaceNumberBadgeStyle = (setColor) => {
  const theme = getSetColorTheme(setColor);
  return {
    background: theme.solid,
    color: 'var(--ms-on-dark)',
    border: `1px solid ${theme.border}`,
    fontSize: '0.78rem',
    letterSpacing: '0.02em',
    minWidth: '2.5rem',
  };
};

export const formatSystemRaceNumber = (displayNumber) => (
  displayNumber != null && displayNumber !== '' ? `Sys. ${displayNumber}` : 'Sys. -'
);

export { SET_COLOR_OPTIONS };
