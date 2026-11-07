// Pure start-list rules shared by StartListManager and TimekeeperRacers.
//
// The bib-number uniqueness rule guards race-day data integrity and used to
// exist in three near-identical copies; keeping one implementation is the point
// of this module. Everything here is pure - no React, no fetching.
import { isRaceNumberCode, normalizeRaceNumberCode } from '../../utils/raceNumbers.js';

/**
 * Vyřazený ze startky - nedorazil nebo nestihl start.
 *
 * Řádek se nemaže, aby šel kdykoli vrátit i se vším, co u něj bylo zapsané
 * (dres, startovní číslo, časy). Dokud je vyřazený, pro startovku, zadávání
 * časů, výsledky ani body neexistuje; vidět je jen v Listině, kde se vrací.
 *
 * Tohle je jediné místo, kde se o vyřazení rozhoduje - obrazovky, inbox
 * časomíry i řazení výsledků volají isExcluded / activeEntries. Server drží
 * totéž pravidlo podmínkou `excluded = 0` (veřejný web, výsledky, body).
 */
export const isExcluded = (entry) => Boolean(entry?.excluded);

/** Řádky, které na startovce opravdu jsou - bez vyřazených. */
export const activeEntries = (entries) => (entries || []).filter((entry) => !isExcluded(entry));

/**
 * Kategorie k tisku bez vyřazených závodníků. Kategorie, ve které nikdo
 * nezůstal, vypadne celá - jinak by se tiskla prázdná hlavička.
 *
 * @param {Array} categories [{ ..., entries }]
 */
export const withoutExcluded = (categories) =>
  (categories || [])
    .map((category) => ({ ...category, entries: activeEntries(category.entries) }))
    .filter((category) => category.entries.length > 0);

/** Start-list order: category rank, then start number, then id. */
export const sortStartListEntries = (entries) =>
  [...entries].sort((a, b) => {
    const aRank = a.category_rank ?? Number.MAX_SAFE_INTEGER;
    const bRank = b.category_rank ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    const aStart = a.start_number ?? Number.MAX_SAFE_INTEGER;
    const bStart = b.start_number ?? Number.MAX_SAFE_INTEGER;
    if (aStart !== bStart) return aStart - bStart;
    return a.id - b.id;
  });

const isBlank = (value) => value === '' || value === null || value === undefined;

/** Look a system (display) number up in the active race-number options. */
export const findRaceNumberOption = (options, displayNumber) => {
  if (isBlank(displayNumber)) return null;
  const code = normalizeRaceNumberCode(displayNumber);
  return options.find((option) => normalizeRaceNumberCode(option.display_number) === code) || null;
};

/**
 * Validate a system number against the option list and the current start list.
 *
 * @param {string|number} displayNumber
 * @param {Object} context
 * @param {Array} context.options - race-number options
 * @param {Array} context.entries - current start list
 * @param {number|null} [context.excludeEntryId] - the entry being edited.
 *   `null` is the add-a-racer path: nothing to exempt, every entry conflicts.
 * @returns {string} Czech error message, or '' when the number is usable
 */
export const getRaceNumberValidationError = (
  rawNumber,
  { options = [], entries = [], excludeEntryId = null } = {},
) => {
  if (isBlank(rawNumber)) return '';
  if (!isRaceNumberCode(rawNumber)) {
    return 'Číslo zadejte jako písmeno sady a číslo dresu, např. A12';
  }
  const displayNumber = normalizeRaceNumberCode(rawNumber);

  const currentEntry =
    excludeEntryId != null ? entries.find((entry) => entry.id === excludeEntryId) || null : null;
  const isCurrentEntryNumber =
    currentEntry &&
    currentEntry.race_number_display != null &&
    normalizeRaceNumberCode(currentEntry.race_number_display) === displayNumber;

  if (!findRaceNumberOption(options, displayNumber) && !isCurrentEntryNumber) {
    return `St. číslo ${displayNumber} neexistuje nebo je neaktivní`;
  }

  const conflict = entries.find(
    (entry) =>
      entry.id !== excludeEntryId &&
      entry.race_number_display != null &&
      normalizeRaceNumberCode(entry.race_number_display) === displayNumber,
  );

  if (conflict) {
    return `St. číslo ${displayNumber} už má ${conflict.racer_surname} ${conflict.racer_name}`;
  }

  return '';
};

/**
 * Oficiální název kategorie tak, jak je nastavený v adminu.
 *
 * Kódové označení ("U10") je jen doplňková informace, nikdy náhrada názvu.
 * Fallback skládá název z kódu a pohlaví - stejně jako compose_category_name
 * na serveru - pro kategorie, které zatím nemají vyplněný display_name.
 */
export const categoryLabel = (category) => {
  if (!category) return '';
  if (category.display_name) return category.display_name;
  const code = category.name || category.code || '';
  if (!code) return '';
  return category.sex_label && category.sex_label !== 'Mix'
    ? `${code} - ${category.sex_label}`
    : code;
};

/**
 * Which category a racer will land in once saved. The server recomputes this,
 * so it is only a preview.
 *
 * @param {Array} categories
 * @param {string|number} year
 * @param {string|number} sex
 * @param {string} pendingLabel - shown while year/sex are still incomplete
 * @param {string} [noMatchLabel] - shown when no category matches;
 *   the two screens word this differently, so it is passed in.
 */
export const resolveCategoryPreview = (
  categories,
  year,
  sex,
  pendingLabel,
  noMatchLabel = pendingLabel,
) => {
  if (!year || !sex || categories.length === 0) return pendingLabel;

  const parsedYear = parseInt(year, 10);
  const parsedSex = parseInt(sex, 10);
  if (Number.isNaN(parsedYear) || Number.isNaN(parsedSex)) return pendingLabel;

  const match = categories.find(
    (category) =>
      category.min_birth_year <= parsedYear &&
      category.max_birth_year >= parsedYear &&
      (category.sex === 0 || category.sex === parsedSex),
  );

  if (!match) return noMatchLabel;
  return categoryLabel(match);
};

/**
 * Seskupí řádky startovní listiny po kategoriích v pořadí startu.
 *
 * Tvar odpovídá tomu, co vrací /results (a co čeká generátor listiny), takže
 * se z rozpracované startovky dá tisknout stejná sestava jako z Výsledků.
 */
export const groupEntriesByCategory = (entries) => {
  const groups = [];
  const indexByKey = new Map();

  for (const entry of sortStartListEntries(entries)) {
    const key = entry.category_id || `none-${entry.category_name || ''}`;
    if (!indexByKey.has(key)) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        category_id: entry.category_id ?? null,
        category_name: entry.category_name || 'Bez kategorie',
        rank: entry.category_rank ?? Number.MAX_SAFE_INTEGER,
        entries: [],
      });
    }
    groups[indexByKey.get(key)].entries.push(entry);
  }

  return groups.sort((a, b) => a.rank - b.rank);
};

/**
 * Shown when TimekeeperAPI.put/post resolved to `{queued: true, offline: true,
 * message}` - i.e. the mutation was parked in the offline queue and there is no
 * `entry` to merge. Pushing that missing entry into React state used to
 * white-screen the whole app.
 */
export const OFFLINE_QUEUED_TEXT = 'Změna byla uložena lokálně a čeká na synchronizaci.';
