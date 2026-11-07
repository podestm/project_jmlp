// Čisté funkce správy sezón (AdminSezony) – bez Reactu, s testem.
import { czechPlural } from '../../../utils/races.js';
import { seasonEdition, seasonIdForDate, toRoman } from '../../../utils/season.js';

/** Prázdný formulář nové sezóny: sezóna podle dnešního data a její ročník. */
export const emptySeasonForm = () => {
  const yearStart = seasonIdForDate();
  return { year_start: yearStart, edition: seasonEdition(yearStart), name: 'Jihomoravský lyžařský pohár' };
};

/** Formulář úpravy podle uložené sezóny. */
export const seasonForm = (season) => ({
  year_start: season.year_start,
  edition: season.edition ?? '',
  name: season.name,
});

/** Tělo požadavku: rok se posílá jen u nové sezóny. */
export const seasonPayload = (formData, isNew) => ({
  edition: formData.edition === '' ? null : Number(formData.edition),
  name: formData.name,
  ...(isNew ? { year_start: Number(formData.year_start) } : {}),
});

/** „XX.“ z čísla ročníku, prázdný ročník „—“. */
export const editionPreview = (edition) => (edition === '' || edition == null ? '—' : `${toRoman(edition)}.`);

/** „1. 8. 2026 – 31. 7. 2027“ */
export const seasonRange = (yearStart) => `1. 8. ${yearStart} – 31. 7. ${Number(yearStart) + 1}`;

/**
 * Aktuální sezóna seznamu: ta, kterou správce označil; dokud žádná označená
 * není, `fallbackId` (useCurrentSeason – podle data).
 */
export const currentSeasonOf = (seasons, fallbackId) => (
  seasons.find((season) => season.is_current)?.year_start ?? fallbackId
);

/** Běžící a připravené (od aktuální dál) a archiv (starší). */
export const splitSeasons = (seasons, currentSeasonId) => ({
  upcoming: seasons.filter((season) => season.year_start >= currentSeasonId),
  archive: seasons.filter((season) => season.year_start < currentSeasonId),
});

/** Stav sezóny slovy: aktuální / připravená / archiv. */
export const seasonState = (season, currentSeasonId) => {
  if (season.year_start === currentSeasonId) return 'Aktuální sezóna';
  return season.year_start > currentSeasonId ? 'Připravená' : 'Archiv';
};

/** „2 závody · 0 dokumentů“ */
export const seasonCounts = (season) => [
  `${season.races_count} ${czechPlural(season.races_count, ['závod', 'závody', 'závodů'])}`,
  `${season.documents_count} ${czechPlural(season.documents_count, ['dokument', 'dokumenty', 'dokumentů'])}`,
].join(' · ');

/** Text vedle H1: „16 ročníků v databázi · XX. ročník právě běží“. */
export const seasonsMeta = (seasons, currentSeasonId) => {
  const current = seasons.find((season) => season.year_start === currentSeasonId);
  const count = `${seasons.length} ${czechPlural(seasons.length, ['ročník', 'ročníky', 'ročníků'])} v databázi`;
  return current?.edition_label ? `${count} · ${current.edition_label} ročník právě běží` : count;
};
