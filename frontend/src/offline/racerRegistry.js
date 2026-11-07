// Lokální kopie registru závodníků pro offline dohlášku.
//
// Na kopci často není signál, a přidat do závodu závodníka z registru musí
// jít i tak. Časomíra si proto celý registr (kompaktně, bez kontaktů) drží
// v IndexedDB - jde přes TimekeeperAPI.get, takže se online obnoví a offline
// se čte z keše - a hledá v něm lokálně.
import { TimekeeperAPI } from '../config/timekeeperApi.js';
import { normalizeRaceNumberCode } from '../utils/raceNumbers.js';
import { isOnline } from './connectivity.js';
import { readCachedResponse } from './startListCache.js';

export const RACER_SNAPSHOT_ENDPOINT = '/api/timekeeper/racers/snapshot';

/** Načte registr: online čerstvý (a uloží ho), offline z keše. */
export const loadRacerRegistry = async () => {
  try {
    const data = await TimekeeperAPI.get(RACER_SNAPSHOT_ENDPOINT);
    return Array.isArray(data) ? data : [];
  } catch {
    const cached = await readCachedResponse(RACER_SNAPSHOT_ENDPOINT, {});
    return Array.isArray(cached) ? cached : [];
  }
};

/**
 * Připraví do zařízení všechno, co offline dohláška potřebuje: registr,
 * kategorie, dresová čísla a kluby. Volá se na pozadí po spuštění časomíry
 * (TimekeeperLayout) - obrazovka Závodníci pak funguje bez signálu, i když
 * se online vůbec neotevřela.
 */
export const preloadOfflineRacerData = async () => {
  if (!isOnline()) return;
  await Promise.allSettled([
    TimekeeperAPI.get(RACER_SNAPSHOT_ENDPOINT),
    TimekeeperAPI.get('/api/timekeeper/categories'),
    TimekeeperAPI.get('/api/timekeeper/race-number-options'),
    TimekeeperAPI.get('/clubs/'),
  ]);
};

const fold = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Hledání jako na serveru (GET /api/timekeeper/racers/search): po slovech,
 * každé slovo musí být v jméně, příjmení nebo ID závodníka, na pořadí
 * nezáleží („Mor Radka“ najde „More Radka“). Diakritika a velikost písmen
 * nerozhodují.
 */
export const searchRacers = (registry, query, limit = 20) => {
  const needle = fold(query);
  const words = needle.split(/\s+/).filter(Boolean).slice(0, 4);
  if (needle.length < 2 || words.length === 0 || !Array.isArray(registry)) return [];
  const found = [];
  for (const racer of registry) {
    const fields = [racer.name, racer.surname, racer.slcr_id].map(fold);
    if (words.every((word) => fields.some((text) => text.includes(word)))) {
      found.push(racer);
      if (found.length >= limit) break;
    }
  }
  return found;
};

/**
 * Řádek startovky pro závodníka přidaného offline - aby se hned objevil ve
 * startovce a dalo se mu měřit. Kategorii, startovní číslo i dres po
 * synchronizaci určí server; tohle je lokální návrh podle stejných pravidel.
 *
 * @param {object} options
 * @param {number} options.tempId       dočasné záporné id (offlineEntries.newTempEntryId)
 * @param {number} options.raceId
 * @param {object} options.payload      tělo POST .../start-list/entry
 * @param {Array}  options.startList    současná startovka závodu
 * @param {Array}  options.categories   aktivní kategorie (/api/timekeeper/categories)
 * @param {Array}  options.raceNumberOptions  dresová čísla (/api/timekeeper/race-number-options)
 */
export const buildLocalEntry = ({
  tempId,
  raceId,
  payload,
  startList = [],
  categories = [],
  raceNumberOptions = [],
}) => {
  const year = Number(payload.racer_year);
  const sex = Number(payload.racer_sex);
  const category =
    categories.find(
      (item) =>
        item.min_birth_year <= year &&
        item.max_birth_year >= year &&
        (item.sex === 0 || item.sex === sex),
    ) || null;
  const sameCategory = category
    ? startList.find((entry) => Number(entry.category_id) === Number(category.id))
    : null;
  const display =
    payload.race_number_display != null && payload.race_number_display !== ''
      ? normalizeRaceNumberCode(payload.race_number_display)
      : null;
  const option =
    display != null
      ? raceNumberOptions.find(
          (item) => normalizeRaceNumberCode(item.display_number) === display,
        ) || null
      : null;
  const startNumbers = startList.map((entry) => Number(entry.start_number)).filter(Number.isFinite);

  return {
    id: tempId,
    race_id: Number(raceId),
    racer_id: payload.racer_id ?? null,
    racer_name: payload.racer_name,
    racer_surname: payload.racer_surname,
    racer_year: year,
    racer_sex: sex,
    club_name: payload.club_name,
    slcr_id: payload.racer_slcr_id ?? null,
    category_id: category?.id ?? null,
    category_name: category?.display_name || category?.name || null,
    category_display_name: category?.display_name || category?.name || null,
    category_sex: category?.sex ?? null,
    category_rank: sameCategory?.category_rank ?? null,
    start_number: (startNumbers.length ? Math.max(...startNumbers) : 0) + 1,
    race_number_id: option?.id ?? null,
    race_number_display: display,
    race_number_actual: option?.actual_number ?? null,
    set_color: option?.set_color ?? null,
    set_number: option?.set_number ?? null,
    time1: null,
    time2: null,
    time_sum: null,
    dnf: false,
    dns: false,
    dsq: false,
    excluded: false,
    updated_at: null,
    pending_sync: true,
  };
};
