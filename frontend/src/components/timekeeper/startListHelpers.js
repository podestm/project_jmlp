// Pure start-list rules shared by StartListManager and TimekeeperRacers.
//
// The bib-number uniqueness rule guards race-day data integrity and used to
// exist in three near-identical copies; keeping one implementation is the point
// of this module. Everything here is pure - no React, no fetching.

/** Start-list order: category rank, then start number, then id. */
export const sortStartListEntries = (entries) => [...entries].sort((a, b) => {
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
  return options.find((option) => String(option.display_number) === String(displayNumber)) || null;
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
export const getRaceNumberValidationError = (displayNumber, { options = [], entries = [], excludeEntryId = null } = {}) => {
  if (isBlank(displayNumber)) return '';

  const currentEntry = excludeEntryId != null
    ? entries.find((entry) => entry.id === excludeEntryId) || null
    : null;
  const isCurrentEntryNumber = currentEntry
    && currentEntry.race_number_display != null
    && String(currentEntry.race_number_display) === String(displayNumber);

  if (!findRaceNumberOption(options, displayNumber) && !isCurrentEntryNumber) {
    return `St. číslo ${displayNumber} neexistuje nebo je neaktivní`;
  }

  const conflict = entries.find((entry) => (
    entry.id !== excludeEntryId
    && entry.race_number_display != null
    && String(entry.race_number_display) === String(displayNumber)
  ));

  if (conflict) {
    return `St. číslo ${displayNumber} už má ${conflict.racer_surname} ${conflict.racer_name}`;
  }

  return '';
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
export const resolveCategoryPreview = (categories, year, sex, pendingLabel, noMatchLabel = pendingLabel) => {
  if (!year || !sex || categories.length === 0) return pendingLabel;

  const parsedYear = parseInt(year, 10);
  const parsedSex = parseInt(sex, 10);
  if (Number.isNaN(parsedYear) || Number.isNaN(parsedSex)) return pendingLabel;

  const match = categories.find((category) => (
    category.min_birth_year <= parsedYear
    && category.max_birth_year >= parsedYear
    && (category.sex === 0 || category.sex === parsedSex)
  ));

  if (!match) return noMatchLabel;
  return match.sex_label === 'Mix' ? match.name : `${match.name} - ${match.sex_label}`;
};

/**
 * Shown when TimekeeperAPI.put/post resolved to `{queued: true, offline: true,
 * message}` - i.e. the mutation was parked in the offline queue and there is no
 * `entry` to merge. Pushing that missing entry into React state used to
 * white-screen the whole app.
 */
export const OFFLINE_QUEUED_TEXT = 'Změna byla uložena lokálně a čeká na synchronizaci.';
