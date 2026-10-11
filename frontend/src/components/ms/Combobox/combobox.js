import { normalizeForSearch } from '../../../utils/text.js';

/** Volby, jejichž popisek obsahuje dotaz bez ohledu na diakritiku (prázdný dotaz = všechny). */
export const filterOptions = (options, query) => {
  const needle = normalizeForSearch(query);
  if (!needle) return options;
  return options.filter((option) => normalizeForSearch(option.label).includes(needle));
};
