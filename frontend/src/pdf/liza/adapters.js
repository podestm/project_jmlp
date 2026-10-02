/**
 * Převod dat časomíry na vstup listin v podobě z LiZy.
 *
 * Vstupem jsou řádky startovní listiny tak, jak je vrací API časomíry (a jak
 * je drží offline cache), seskupené po kategoriích (groupEntriesByCategory).
 * Pořadí a body se počítají lokálně stejně jako na obrazovce výsledků, aby
 * listina seděla i s časy, které se ještě nestihly odeslat na server.
 */
import { rankEntriesByTime } from '../../components/timekeeper/ResultsTable.jsx';
import { categoryCode, setName } from './clubList.js';

/** Startovní číslo, které má závodník na dresu; bez přiděleného dresu pořadí startu. */
const bibOf = (entry) => entry.race_number_actual ?? entry.start_number ?? null;

/** Nedokončené 1. kolo - ve 2. kole se nestartuje. */
const finishedFirstRun = (entry) => entry.time1 != null && !entry.dnf && !entry.dns && !entry.dsq;

/** Pořadí startu v rámci kategorie (startovní číslo, pak id kvůli stabilitě). */
const byStartOrder = (a, b) => (
  (a.start_number ?? Number.MAX_SAFE_INTEGER) - (b.start_number ?? Number.MAX_SAFE_INTEGER)
  || (a.id ?? 0) - (b.id ?? 0)
);

export const SECOND_RUN_SAME = 'same';
export const SECOND_RUN_BY_RESULTS = 'results';

/**
 * Startující 2. kola jedné kategorie.
 *
 * Kdo měl v 1. kole DSQ, DNF nebo DNS (nebo nemá čas), ve 2. kole nestartuje.
 * Pořadí buď stejné jako v 1. kole, nebo podle výsledků 1. kola - nejrychlejší
 * první, při shodě času pořadí startu 1. kola.
 */
export function secondRunEntries(entries, order = SECOND_RUN_SAME) {
  const starters = (entries || []).filter(finishedFirstRun);
  if (order === SECOND_RUN_BY_RESULTS) {
    return [...starters].sort((a, b) => (a.time1 - b.time1) || byStartOrder(a, b));
  }
  return [...starters].sort(byStartOrder);
}

const startListEntry = (entry) => ({
  number: bibOf(entry),
  slcrId: entry.slcr_id || null,
  surname: entry.racer_surname || '',
  firstName: entry.racer_name || '',
  club: entry.club_name || '',
  nation: 'CZE',
  year: entry.racer_year ?? null
});

/**
 * Kategorie pro startovní listinu kola.
 * @param {Array}  categories  [{ category_name, entries }] v pořadí startu
 * @param {number} round       1 nebo 2
 * @param {string} order       u 2. kola SECOND_RUN_SAME | SECOND_RUN_BY_RESULTS
 */
export function startListCategories(categories, round = 1, order = SECOND_RUN_SAME) {
  return (categories || []).map((category) => ({
    name: category.category_name,
    entries: (round === 2
      ? secondRunEntries(category.entries, order)
      : [...(category.entries || [])].sort(byStartOrder)
    ).map(startListEntry)
  })).filter((category) => category.entries.length > 0);
}

/**
 * Kategorie pro výsledkovou listinu.
 * @param {Array}  categories  [{ category_name, entries }]
 * @param {'final'|'run'|'interim'} mode
 * @param {number} run         u mode 'run' číslo kola
 */
export function resultCategories(categories, mode = 'final', run = 1) {
  const timeField = mode === 'run' ? `time${run}` : 'time_sum';
  return (categories || []).map((category) => ({
    name: category.category_name,
    entries: rankEntriesByTime(category.entries || [], { timeField }).map((entry) => ({
      rank: entry.display_rank,
      status: entry.display_rank == null ? (entry.status || null) : null,
      surname: entry.racer_surname || '',
      firstName: entry.racer_name || '',
      bib: bibOf(entry),
      year: entry.racer_year ?? null,
      slcrId: entry.slcr_id || null,
      club: entry.club_name || '',
      nation: 'CZE',
      time1: entry.time1 ?? null,
      time2: entry.time2 ?? null,
      total: entry[timeField] ?? null,
      diff: entry.display_diff ?? null,
      points: entry.display_points || null
    }))
  })).filter((category) => category.entries.length > 0);
}

/**
 * Vstup rozpisu po klubech.
 * @param {Array} categories [{ category_name, entries }] v pořadí kategorií závodu
 */
export function clubListInput(categories) {
  const list = categories || [];
  const entries = list.flatMap((category) => (category.entries || []).map((entry) => ({
    club: entry.club_name || '-',
    bib: bibOf(entry),
    setNumber: entry.set_number ?? null,
    sex: entry.racer_sex ?? entry.category_sex,
    surname: entry.racer_surname || '',
    firstName: entry.racer_name || '',
    year: entry.racer_year ?? null,
    categoryCode: categoryCode(category.category_name, entry.category_sex ?? entry.racer_sex)
  })));
  const setNumbers = [...new Set(entries.map((entry) => entry.setNumber).filter((n) => n != null))]
    .sort((a, b) => a - b);
  return {
    entries,
    sets: setNumbers.map((number) => ({ number, name: setName(number) })),
    categories: list
      .filter((category) => (category.entries || []).length > 0)
      .map((category) => ({
        code: categoryCode(category.category_name, category.entries[0]?.category_sex),
        name: category.category_name
      }))
  };
}
