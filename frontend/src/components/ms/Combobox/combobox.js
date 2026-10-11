/** Text pro porovnání: malá písmena bez diakritiky („Brno“ najde i „BRNO“, „sneh“ i „sněh“). */
export const normalize = (text) => String(text ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim();

/** Volby, jejichž popisek obsahuje dotaz (prázdný dotaz = všechny). */
export const filterOptions = (options, query) => {
  const needle = normalize(query);
  if (!needle) return options;
  return options.filter((option) => normalize(option.label).includes(needle));
};
