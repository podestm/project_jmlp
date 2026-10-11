// Čisté funkce obrazovky Přihlášky k závodu (počty, filtr, skupiny, texty).
import { czechPlural } from '../../../utils/races.js';

/** Backend tak pojmenuje klub u přihlášky, která čeká na vyřízení žádosti o klub. */
export const WAITING_CLUB = 'Nový Klub';

export const isWaitingForClub = (registration) => registration.club_name === WAITING_CLUB;

/** Název skupiny v seznamu (místo zástupného „Nový Klub“ věta). */
export const clubLabel = (clubName) => (clubName === WAITING_CLUB ? 'Čeká na přiřazení klubu' : clubName);

/** „Novák Matyáš“ – příjmení první jako ve startovní listině. */
export const racerName = (registration) => [registration.lastName, registration.firstName].filter(Boolean).join(' ');

/** Dlaždice nad seznamem. Pohlaví: M = muž, Z = žena (jak ho posílá backend). */
export const registrationStats = (registrations) => ({
  total: registrations.length,
  men: registrations.filter((r) => r.sex === 'M').length,
  women: registrations.filter((r) => r.sex === 'Z').length,
  clubs: new Set(registrations.map((r) => r.club_name)).size,
  withoutSlcr: registrations.filter((r) => !r.idSlcr).length,
  waitingForClub: registrations.filter(isWaitingForClub).length,
});

const collator = new Intl.Collator('cs');
const byName = (a, b) => collator.compare(a.lastName ?? '', b.lastName ?? '') || collator.compare(a.firstName ?? '', b.firstName ?? '');

/** Kluby do filtru, abecedně; čekající na klub na konci. */
export const clubOptions = (registrations) => {
  const names = [...new Set(registrations.map((r) => r.club_name))];
  return names.sort((a, b) => (a === WAITING_CLUB) - (b === WAITING_CLUB) || collator.compare(a ?? '', b ?? ''));
};

/** Hledání bez ohledu na velikost písmen a diakritiku. */
const fold = (text) => String(text ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export const EMPTY_FILTER = { query: '', club: '' };

export const isFiltered = (filter) => Boolean(filter.query.trim() || filter.club);

export const filterRegistrations = (registrations, { query, club }) => {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return registrations.filter((r) => {
    if (club && r.club_name !== club) return false;
    const name = fold(`${r.firstName} ${r.lastName}`);
    return words.every((word) => name.includes(word));
  });
};

/**
 * Skupiny seznamu: podle klubu (abecedně, čekající na klub na konci),
 * nebo jedna skupina bez nadpisu seřazená podle příjmení.
 */
export const groupRegistrations = (registrations, sort) => {
  if (sort === 'name') {
    return [{ key: 'all', label: null, waiting: false, items: [...registrations].sort(byName) }];
  }
  return clubOptions(registrations).map((club) => ({
    key: club,
    label: clubLabel(club),
    waiting: club === WAITING_CLUB,
    items: registrations.filter((r) => r.club_name === club).sort(byName),
  }));
};

/** „23. 9. 14:02“ (prázdné datum → prázdný text). */
export const formatRegisteredAt = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const time = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  return `${date.getDate()}. ${date.getMonth() + 1}. ${time}`;
};

/** Text vedle H1: „Brno – Kohoutovice, 3. 10. 2026“ (bez závodu jen číslo). */
export const raceMeta = (race, raceId) => {
  const place = race?.areal_name || race?.race_nr || `#${raceId}`;
  const date = race?.datum ? new Date(race.datum).toLocaleDateString('cs-CZ') : null;
  return [place, date].filter(Boolean).join(', ');
};

export const racersWord = (count) => czechPlural(count, ['závodník', 'závodníci', 'závodníků']);

/** M = muž, Z = žena; bez údaje prázdné. */
export const sexLabel = (sex) => ({ M: 'Muž', Z: 'Žena' }[sex] ?? '');
