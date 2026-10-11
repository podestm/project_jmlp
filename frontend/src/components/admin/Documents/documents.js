// Čisté funkce knihovny dokumentů (AdminDokumenty) – bez Reactu, s testem.
import { getExtension } from '../../../utils/files.js';
import { czechPlural } from '../../../utils/races.js';

export const EMPTY_FILTERS = {
  q: '',
  extension: '',
  owner_type: '',
  date_from: '',
  date_to: '',
};

export const hasFilters = (filters) => Object.values(filters).some((value) => value !== '');

/** Starší sezóny se do nabídky nevejdou a nikdo do nich už nic nezveřejňuje. */
export const OFFERED_SEASONS = 4;

/** Nabídka přípon se bere z dat, ať tam nejsou volby bez jediného souboru. */
export const collectExtensions = (files) => {
  const seen = new Set();
  files.forEach((file) => {
    const ext = getExtension(file.original_filename);
    if (ext) seen.add(ext);
  });
  return Array.from(seen).sort();
};

/** Štítek použití: „Sezóna · zveřejněno“ (stav slovy, ne jen barvou). */
export const usageLabel = (item) => `${item.type} · ${item.published ? 'zveřejněno' : 'skryto'}`;

/** Jedno místo použití do dialogu smazání: „Sezóna – 2026/2027“. */
export const usageText = (item) => `${item.type} – ${item.title}`;

/** Volby sezón k zveřejnění: čtyři nejnovější, „2026/2027 · XX. ročník“. */
export const seasonChoices = (seasons) => seasons.slice(0, OFFERED_SEASONS).map((season) => ({
  value: season.year_start,
  seasonLabel: season.season_label,
  label: [season.season_label, season.edition_label && `${season.edition_label} ročník`].filter(Boolean).join(' · '),
  description: [
    season.active && 'aktuální sezóna',
    `teď ${season.documents_count ?? 0} ${czechPlural(season.documents_count ?? 0, ['dokument', 'dokumenty', 'dokumentů'])}`,
  ].filter(Boolean).join(' · '),
}));

/** Výchozí volba: aktivní sezóna, jinak nejnovější. */
export const defaultSeason = (seasons) => {
  const offered = seasons.slice(0, OFFERED_SEASONS);
  return (offered.find((season) => season.active) ?? offered[0])?.year_start ?? null;
};
