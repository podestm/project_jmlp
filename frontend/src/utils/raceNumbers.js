const SET_COLOR_OPTIONS = [
  { value: 'rose', label: 'Ruzova', solid: '#e94560', soft: 'rgba(233, 69, 96, 0.10)', border: 'rgba(233, 69, 96, 0.35)' },
  { value: 'blue', label: 'Modra', solid: '#2563eb', soft: 'rgba(37, 99, 235, 0.10)', border: 'rgba(37, 99, 235, 0.35)' },
  { value: 'emerald', label: 'Zelena', solid: '#059669', soft: 'rgba(5, 150, 105, 0.10)', border: 'rgba(5, 150, 105, 0.35)' },
  { value: 'amber', label: 'Oranzova', solid: '#d97706', soft: 'rgba(217, 119, 6, 0.10)', border: 'rgba(217, 119, 6, 0.35)' },
  { value: 'violet', label: 'Fialova', solid: '#7c3aed', soft: 'rgba(124, 58, 237, 0.10)', border: 'rgba(124, 58, 237, 0.35)' },
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

export const formatSystemRaceNumber = (displayNumber) => (
  displayNumber != null && displayNumber !== '' ? `Sys. ${displayNumber}` : 'Sys. -'
);

export { SET_COLOR_OPTIONS };