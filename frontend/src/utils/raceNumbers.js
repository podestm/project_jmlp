// `solid` nese bílé číslo, proto jde přes téma back-office (admin.css, --tk-set-*),
// které dosadí tmavší odstín s kontrastem aspoň 4.5:1. Původní barva zůstává
// jako výchozí hodnota pro místa bez tématu (veřejný Live timing).
const SET_COLOR_OPTIONS = [
  { value: 'rose', label: 'Ruzova', solid: 'var(--tk-set-rose, #e94560)', soft: 'rgba(233, 69, 96, 0.10)', border: 'rgba(233, 69, 96, 0.35)' },
  { value: 'blue', label: 'Modra', solid: 'var(--tk-set-blue, #2563eb)', soft: 'rgba(37, 99, 235, 0.10)', border: 'rgba(37, 99, 235, 0.35)' },
  { value: 'emerald', label: 'Zelena', solid: 'var(--tk-set-emerald, #059669)', soft: 'rgba(5, 150, 105, 0.10)', border: 'rgba(5, 150, 105, 0.35)' },
  { value: 'amber', label: 'Oranzova', solid: 'var(--tk-set-amber, #d97706)', soft: 'rgba(217, 119, 6, 0.10)', border: 'rgba(217, 119, 6, 0.35)' },
  { value: 'violet', label: 'Fialova', solid: 'var(--tk-set-violet, #7c3aed)', soft: 'rgba(124, 58, 237, 0.10)', border: 'rgba(124, 58, 237, 0.35)' },
];

const DEFAULT_THEME = SET_COLOR_OPTIONS[0];

export const getSetColorTheme = (setColor) => (
  SET_COLOR_OPTIONS.find((option) => option.value === setColor) || DEFAULT_THEME
);

export const getRaceNumberBadgeStyle = (setColor) => {
  const theme = getSetColorTheme(setColor);
  return {
    background: theme.solid,
    color: '#ffffff',
    border: `1px solid ${theme.border}`,
    fontSize: '0.78rem',
    letterSpacing: '0.02em',
    minWidth: '2.5rem',
  };
};

/**
 * Systémové označení čísla: písmeno sady + číslo dresu ("B12" = dres 12
 * ze sady 2). Ukládá ho server (display_number / race_number_display).
 */
export const formatSystemRaceNumber = (displayNumber) => (
  displayNumber != null && displayNumber !== '' ? String(displayNumber) : ''
);

const RACE_NUMBER_CODE = /^([A-Z])(\d{1,4})$/;

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