// JS zrcadlo barevných tokenů ze src/styles/ms/tokens.css – pro místa, kam
// CSS proměnná nedosáhne (Chart.js, barvy dresů v datech). Shodu se
// stylesheetem hlídá tokens.test.js; měnit se musí oba soubory naráz.
export const colors = Object.freeze({
  navy: '#003F60',
  navyDeep: '#00293E',
  ice: '#9FC4D3',
  sun: '#F28C28',
  sunInk: '#A84A00',
  red: '#B33639',
  open: '#17654C',
  onDark: '#FFFFFF',
  surfacePage: '#F4F8FB',
  surfaceCard: '#FFFFFF',
  surfaceSunken: '#E7F0F5',
  ink: '#0E1D26',
  inkBody: '#3C4E59',
  inkMuted: '#5A6E79',
  line: '#D9E5EC',
  lineControl: '#6E8494',
  liveInk: '#A32E31',
  dryBg: '#FFF4E2',
  dryInk: '#7A4E00',
  amber: '#C08A00',
  amberInk: '#1A1400',
});

// Sady startovních čísel (skutečné barvy dresů), všechny nesou bílé číslo.
export const bibColors = Object.freeze({
  rose: '#BE123C',
  blue: '#2563EB',
  emerald: '#047857',
  amber: '#B45309',
  violet: '#7C3AED',
});

/** Název CSS proměnné k tokenu: cssVar('navyDeep') → '--ms-navy-deep'. */
export const cssVar = (name) => `--ms-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

/** Název CSS proměnné k sadě dresů: bibVar('rose') → '--ms-bib-rose'. */
export const bibVar = (name) => `--ms-bib-${name}`;
