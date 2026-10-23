// Čistá pravidla zadávání časů - žádný React, žádné volání serveru.
//
// Vytaženo z TimingEntry.jsx: obrazovka měla přes 1900 řádků a tahle část se
// nedala testovat bez vykreslení celé tabulky, přestože je to obyčejná
// aritmetika a porovnávání.

/** Čas z formuláře nebo serveru; prázdný, nesmyslný i nulový (0, 0.0, 0.00) = null. */
export const parseStoredTime = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
};

/** Stejné pravidlo jako v backend/app/routers/timekeeper/timing.py. */
export const calculateTimeSum = (data) => {
  if (data.dnf || data.dns || data.dsq) return null;
  const time1 = parseStoredTime(data.time1);
  const time2 = parseStoredTime(data.time2);
  if (time1 != null && time2 != null) return time1 + time2;
  return time1 ?? time2 ?? null;
};

/** Tělo požadavku na uložení času jednoho řádku. */
export const buildTimeUpdate = (data) => ({
  base_revision: data.base_revision || null,
  force_apply: Boolean(data.force_apply) || false,
  time1: parseStoredTime(data.time1),
  time2: parseStoredTime(data.time2),
  dnf: data.dnf || false,
  dns: data.dns || false,
  dsq: data.dsq || false,
});

/** Hodnoty na společný tvar, aby '25.50' a 25.5 nebyly dvě různé věci. */
export const normalizeDraft = (data) => ({
  time1: parseStoredTime(data?.time1),
  time2: parseStoredTime(data?.time2),
  dnf: Boolean(data?.dnf),
  dns: Boolean(data?.dns),
  dsq: Boolean(data?.dsq),
});

export const isSameDraft = (a, b) => {
  const x = normalizeDraft(a);
  const y = normalizeDraft(b);
  return x.time1 === y.time1 && x.time2 === y.time2 && x.dnf === y.dnf && x.dns === y.dns && x.dsq === y.dsq;
};

/**
 * Vrátí rozepsané časy z minulého běhu zpátky do formuláře.
 *
 * Draft se ponechá jen tehdy, když serverový řádek pořád nese přesně tu
 * hodnotu, proti které se psal (`base`). Když se mezitím změnila, vyhrává
 * server a draft se zahodí - jinak by starý rozepsaný čas přepsal novější
 * výsledek z jiné karty.
 *
 * @returns {{times: Object, restored: number, dropped: number}}
 */
export const mergeRestoredDrafts = (serverTimes, entriesById, drafts) => {
  const times = { ...serverTimes };
  let restored = 0;
  let dropped = 0;

  Object.entries(drafts || {}).forEach(([entryId, draft]) => {
    const serverDraft = serverTimes[entryId];
    const entry = entriesById[entryId];
    if (!serverDraft || !entry || !draft) return;

    if (draft.base && !isSameDraft(draft.base, serverDraft)) {
      dropped += 1;
      return;
    }
    if (isSameDraft(draft, serverDraft)) return;

    times[entryId] = {
      time1: draft.time1 ?? '',
      time2: draft.time2 ?? '',
      dnf: Boolean(draft.dnf),
      dns: Boolean(draft.dns),
      dsq: Boolean(draft.dsq),
    };
    restored += 1;
  });

  return { times, restored, dropped };
};

export const CONFLICT_FIELDS = [
  ['time1', 'Jízda 1'],
  ['time2', 'Jízda 2'],
  ['dnf', 'DNF'],
  ['dns', 'DNS'],
  ['dsq', 'DSQ'],
];

export const formatConflictValue = (value) => {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Ano' : 'Ne';
  return String(value);
};

/**
 * Šipka nahoru/dolů při zadávání časů: index nejbližšího řádku ve směru
 * `direction` (-1 nahoru, +1 dolů), jehož políčko jde vyplnit. Řádky se
 * zamčeným políčkem (DNF/DNS/DSQ, zamčené kolo) se přeskočí. Za okrajem
 * seznamu zůstane fokus, kde je (null).
 */
export const findRowInDirection = (list, currentIndex, direction, isEnabled) => {
  for (let index = currentIndex + direction; index >= 0 && index < list.length; index += direction) {
    if (isEnabled(list[index])) return index;
  }
  return null;
};
