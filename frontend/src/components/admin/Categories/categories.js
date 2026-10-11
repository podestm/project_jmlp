// Čisté funkce správy kategorií (AdminKategorie) – bez Reactu, s testem.

/** Pohlaví kategorie: 0 = mix, 1 = muži, 2 = ženy. */
export const SEX_OPTIONS = [
  { value: 2, label: 'Ženy' },
  { value: 1, label: 'Muži' },
  { value: 0, label: 'Muži i ženy společně' },
];

export const sexLabel = (sex) => ({ 0: 'Mix', 1: 'Muži', 2: 'Ženy' }[Number(sex)] ?? 'Mix');

/** Prázdný formulář - stejný tvar pro první render i po uložení. */
export const emptyCategoryForm = (year = new Date().getFullYear()) => ({
  name: '',
  display_name: '',
  min_birth_year: year - 50,
  max_birth_year: year - 18,
  sex: 0,
  active: true,
});

/** Formulář úpravy podle uložené kategorie. */
export const categoryForm = (category) => ({
  name: category.name,
  display_name: category.display_name || '',
  min_birth_year: category.min_birth_year,
  max_birth_year: category.max_birth_year,
  sex: category.sex,
  active: category.active,
});

/** Primárně od nejmladších ročníků, sekundárně Mix(0), Muži(1), Ženy(2). Vrací kopii. */
export const sortCategories = (categories) => [...categories].sort((a, b) => (
  b.max_birth_year - a.max_birth_year || a.sex - b.sex
));

/** Hlavní název kategorie: zobrazovaný, jinak interní. */
export const categoryLabel = (category) => category.display_name || category.name;

/** Věkové rozmezí, které kategorie letos pokrývá: „7 – 9 let“. */
export const ageRange = (category, year = new Date().getFullYear()) => (
  `${year - category.max_birth_year} – ${year - category.min_birth_year} let`
);

/** Zrcadlová kategorie: opačné pohlaví, mix zrcadlit nejde (null). */
export const mirrorSex = (sex) => {
  if (Number(sex) === 1) return 2;
  if (Number(sex) === 2) return 1;
  return null;
};

/** Text meta vedle H1: „14 kategorií · 12 aktivních“. */
export const categoriesMeta = (categories) => {
  const active = categories.filter((c) => c.active).length;
  return `${categories.length} kategorií · ${active} aktivních · platí pro celý pohár`;
};
