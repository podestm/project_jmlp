// Filtr přihlášených na detailu závodu (GET /races/{id}/registrations):
// kluby se závodníky, kategorie v pořadí závodu ze serveru.

/** Klíč volby „Bez kategorie“. */
export const NO_CATEGORY = 'none';

export const EMPTY_RACER_FILTER = { club: '', category: '' };

export const isRacerFilterActive = (filter) => Boolean(filter.club || filter.category);

const collator = new Intl.Collator('cs');

/** Kluby do filtru abecedně. */
export const racerClubOptions = (clubs) =>
  clubs.map((club) => club.club_name).sort((a, b) => collator.compare(a ?? '', b ?? ''));

/**
 * Kategorie do filtru v pořadí ze serveru (nejmladší první, ženy před
 * muži); „Bez kategorie“ jen když je někdo bez kategorie.
 */
export const racerCategoryOptions = (registrations) => {
  const options = (registrations?.categories ?? []).map((category) => ({
    value: String(category.id),
    label: category.name,
  }));
  const uncategorized = (registrations?.clubs ?? []).some((club) =>
    club.racers.some((racer) => racer.category_id == null),
  );
  return uncategorized ? [...options, { value: NO_CATEGORY, label: 'Bez kategorie' }] : options;
};

const matchesCategory = (racer, category) =>
  !category ||
  (category === NO_CATEGORY ? racer.category_id == null : String(racer.category_id) === category);

/** Kluby jen se závodníky, kteří filtru odpovídají; prázdné kluby vypadnou. */
export const filterClubs = (clubs, { club, category }) =>
  clubs
    .filter((item) => !club || item.club_name === club)
    .map((item) => ({
      ...item,
      racers: item.racers.filter((racer) => matchesCategory(racer, category)),
    }))
    .filter((item) => item.racers.length > 0);

export const countRacers = (clubs) => clubs.reduce((sum, club) => sum + club.racers.length, 0);
