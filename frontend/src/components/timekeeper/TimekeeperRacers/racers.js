// Závodníci závodu v časomíře (TkZavodnici): popisky a filtry tabulky.

export const getSexLabel = (sex) => {
  if (Number(sex) === 1) return 'Muž';
  if (Number(sex) === 2) return 'Žena';
  return 'Neznámé';
};

/** Zkratka pohlaví do odznaku v tabulce: M / Ž / ?. */
export const getSexLetter = (sex) => {
  if (Number(sex) === 1) return 'M';
  if (Number(sex) === 2) return 'Ž';
  return '?';
};

export const EMPTY_FILTERS = { club: 'all', category: 'all', sex: 'all', text: '' };

export const isFiltered = (filters) =>
  Object.keys(EMPTY_FILTERS).some((key) => filters[key] !== EMPTY_FILTERS[key]);

/** Oddíly na startovce, abecedně. */
export const clubOptionsOf = (entries) =>
  [...new Set(entries.map((entry) => entry.club_name).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'cs'),
  );

/** Kategorie na startovce v pořadí listiny; bez kategorie jako „Bez kategorie“. */
export const categoryOptionsOf = (entries) => [
  ...new Map(
    entries.map((entry) => [
      entry.category_id || `none-${entry.category_name}`,
      entry.category_name || 'Bez kategorie',
    ]),
  ).values(),
];

/** Řádky odpovídající filtrům (oddíl, kategorie, pohlaví, text kdekoli). */
export const filterEntries = (entries, filters) => {
  const text = filters.text.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filters.club !== 'all' && (entry.club_name || 'Bez oddílu') !== filters.club) return false;
    if (filters.category !== 'all' && (entry.category_name || 'Bez kategorie') !== filters.category)
      return false;
    if (filters.sex !== 'all' && String(entry.racer_sex) !== filters.sex) return false;
    if (!text) return true;
    const haystack = [
      entry.racer_name,
      entry.racer_surname,
      entry.club_name,
      entry.category_name,
      entry.race_number_display,
      entry.race_number_actual,
      entry.start_number,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(text);
  });
};

/**
 * Dotaz pro hledání v databázi závodníků z formuláře: SLČR ID, jinak
 * "příjmení jméno" (backend hledá po slovech). Kratší než 2 znaky = nehledat.
 */
export const racerSearchQuery = ({ slcr_id, surname, name }) => {
  const query = [slcr_id?.trim(), `${surname || ''} ${name || ''}`.trim()].find(Boolean) || '';
  return query.length >= 2 ? query : '';
};
