// Čisté funkce obrazovky Závodníci (filtr, popisky, formulář).

// Závodníků jsou v databázi tisíce. Vykreslit je všechny naráz znamená tisíce
// řádků v DOMu a zaseknutou stránku, proto se ukazuje po stovkách.
export const PAGE_SIZE = 100;

// Hledání filtruje celé pole v paměti; bez odkladu by se to přepočítávalo
// (a tabulka překreslovala) po každé stisknuté klávese.
export const SEARCH_DEBOUNCE_MS = 250;

export const MIN_BIRTH_YEAR = 1940;

export const SEX = { male: 1, female: 2 };

/** Prázdný formulář nového závodníka (pohlaví 1 = muž, 2 = žena). */
export const emptyRacerForm = () => ({
  firstName: '',
  lastName: '',
  sex: SEX.male,
  birthYear: new Date().getFullYear() - 20,
  club_id: '',
  idSlcr: '',
});

/** Formulář předvyplněný z existujícího závodníka. */
export const racerToForm = (racer) => ({
  firstName: racer.firstName || '',
  lastName: racer.lastName || '',
  sex: racer.sex || SEX.male,
  birthYear: racer.birthYear || new Date().getFullYear() - 20,
  club_id: racer.club_id || '',
  idSlcr: racer.idSlcr || '',
});

/**
 * Data pro API. Nevybraný klub je ve formuláři prázdný řetězec, ale schéma
 * na serveru čeká číslo nebo nic – prázdný řetězec by skončil chybou 422.
 */
export const racerPayload = (formData) => ({
  ...formData,
  club_id: formData.club_id ? parseInt(formData.club_id, 10) : null,
});

export const EMPTY_FILTER = { club: '', category: '', sex: '' };

/** Filtr klubu, kategorie a pohlaví + hledání ve jméně, příjmení a čísle SLČR. */
export function filterRacers(racers, filter, searchText) {
  const search = (searchText || '').toLowerCase();
  return racers.filter((racer) => {
    if (filter.club && racer.club_id !== parseInt(filter.club, 10)) return false;
    if (filter.category && racer.category_id !== parseInt(filter.category, 10)) return false;
    if (filter.sex && racer.sex !== parseInt(filter.sex, 10)) return false;
    if (search) {
      const matches = [racer.firstName, racer.lastName, racer.idSlcr]
        .some((value) => (value || '').toLowerCase().includes(search));
      if (!matches) return false;
    }
    return true;
  });
}

export const clubOptions = (clubs) => clubs.map((club) => ({ value: String(club.id), label: club.name }));

// Stejné pravidlo jako category_display_sql na serveru: bez toho ukazuje
// filtr interní název, zatímco sloupec v tabulce zobrazovaný, a zrcadlové
// kategorie splynou ve dvě nerozlišitelné položky.
export const categoryLabel = (category) => category.display_name
  || `${category.name}${category.sex === 1 ? ' - Muži' : category.sex === 2 ? ' - Ženy' : ''}`;

export const categoryOptions = (categories) => categories.map((category) => ({
  value: String(category.id),
  label: categoryLabel(category),
}));

/** „Novák Matyáš“ – příjmení napřed jako v ostatních seznamech administrace. */
export const racerName = (racer) => [racer.lastName, racer.firstName].filter(Boolean).join(' ') || `#${racer.id}`;

export const sexLabel = (sex) => (sex === SEX.male ? 'Muž' : sex === SEX.female ? 'Žena' : null);

/** Iniciály do kolečka (Novák Matyáš → NM). */
export const racerInitials = (racer) => [racer.lastName, racer.firstName]
  .map((part) => (part || '').trim().charAt(0).toUpperCase())
  .join('');

/** Řádek údajů pod jménem: ročník · pohlaví · klub · kategorie · SLČR. */
export const racerDetails = (racer) => [
  racer.birthYear,
  sexLabel(racer.sex),
  racer.club_name || 'Bez klubu',
  racer.category_name,
  racer.idSlcr ? `SLČR ${racer.idSlcr}` : 'bez SLČR',
].filter(Boolean).join(' · ');

export const formatCount = (count) => count.toLocaleString('cs-CZ');
