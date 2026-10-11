// Překlad impulzu z časomíry na závodníka.
//
// Jediné místo, kde se to počítá. Dokud si řádek inboxu hledal kandidáty sám,
// uměl zobrazit jednoho závodníka a potvrzení (Přiřadit a uložit) zapsat čas jinému.

import { isExcluded } from './startListHelpers.js';

export const normalizeBib = (value) => {
  const bib = Number(value);
  return Number.isFinite(bib) && bib > 0 ? bib : null;
};

export const matchesBib = (entry, bib) => (
  entry?.race_number_actual != null && Number(entry.race_number_actual) === bib
);

/**
 * Smí se impulz s tímhle dresem zapsat tomuhle závodníkovi?
 *
 * Vyřazený ze startky kandidátem není nikdy - jinak by mu potvrzení zapsalo čas, který
 * patří někomu, kdo jede se stejným číslem z jiné sady.
 */
export const isBibCandidate = (entry, bib) => !isExcluded(entry) && matchesBib(entry, bib);

/** Startovní pořadí, id jako rozhodčí kritérium - pořadí musí být stabilní. */
export const compareCandidates = (a, b) => {
  const aStart = a.start_number ?? Number.MAX_SAFE_INTEGER;
  const bStart = b.start_number ?? Number.MAX_SAFE_INTEGER;
  if (aStart !== bStart) return aStart - bStart;
  return a.id - b.id;
};

export const candidatesForEvent = (event, startList, entriesById) => {
  const stored = Array.isArray(event?.candidateEntryIds)
    ? event.candidateEntryIds.map((id) => entriesById[id]).filter((entry) => entry && !isExcluded(entry))
    : [];

  const bib = normalizeBib(event?.bib);
  if (bib == null) return stored;

  // Uložení kandidáti platí, jen dokud dresy sedí - přečíslování sady je běžné.
  const valid = stored.filter((entry) => matchesBib(entry, bib));
  if (valid.length > 0) return valid;
  return startList.filter((entry) => isBibCandidate(entry, bib)).sort(compareCandidates);
};

/**
 * Patří impulz závodníkovi, který je vyřazený ze startky?
 *
 * Volá se, když žádný kandidát nezbyl. Obsluha pak místo obecného "dres není
 * ve startovní listině" uvidí, že závodník jen nedorazil podle Listiny - a ví,
 * kde ho vrátit, pokud přece jen jel.
 */
export const pointsToExcludedEntry = (event, startList, entriesById) => {
  const bib = normalizeBib(event?.bib);
  if (bib != null) {
    return startList.some((entry) => isExcluded(entry) && matchesBib(entry, bib));
  }
  return Array.isArray(event?.candidateEntryIds)
    && event.candidateEntryIds.some((id) => isExcluded(entriesById[id]));
};

/** Stavy, ve kterých je závodník už rozhodnutý a přepočítávat se nesmí. */
const LOCKED_EVENT_STATUSES = new Set(['saving', 'queued', 'saved', 'rejected']);

/**
 * Komu potvrzení (Přiřadit a uložit) na daném řádku inboxu zapíše.
 *
 * @returns {{entry: Object|null, count: number, index: number, excluded: boolean}}
 *   `excluded` je true, když nikdo nezbyl, protože dres patří vyřazenému
 */
export const resolveInboxEvent = (event, startList, entriesById) => {
  const selectedId = event?.selectedEntryId;
  if (selectedId != null && LOCKED_EVENT_STATUSES.has(event?.status)) {
    // Rozhodnutá událost zůstává u svého závodníka, i když ho mezitím
    // někdo vyřadil - je to záznam toho, co se už stalo.
    const entry = entriesById[selectedId] || null;
    return { entry, count: entry ? 1 : 0, index: entry ? 0 : -1, excluded: false };
  }

  const candidates = candidatesForEvent(event, startList, entriesById);
  const picked = (selectedId != null ? candidates.find((c) => c.id === selectedId) : null)
    || candidates[0]
    || null;
  const index = picked ? candidates.findIndex((c) => c.id === picked.id) : -1;
  return {
    entry: picked,
    count: candidates.length,
    index,
    excluded: !picked && pointsToExcludedEntry(event, startList, entriesById),
  };
};

export const EMPTY_RESOLUTION = Object.freeze({ entry: null, count: 0, index: -1, excluded: false });

/** Pole draftu, do kterého impulz pro dané kolo patří. */
export const roundField = (targetRound) => (String(targetRound) === '2' ? 'time2' : 'time1');

const hasRoundValue = (row, field) => {
  if (!row) return false;
  const value = row[field];
  if (value !== null && value !== undefined && String(value).trim() !== '') return true;
  return Boolean(row.dnf || row.dns || row.dsq);
};

/**
 * Je kolo závodníka prázdné - bez času a bez DNF/DNS/DSQ?
 *
 * Kontroluje se rozepsaný draft i to, co je uložené: rozepsaný a neuložený čas
 * je pořád hodnota, kterou automatický zápis nesmí přepsat.
 */
export const isRoundEmpty = (entry, draft, field) => (
  !hasRoundValue(entry, field) && !hasRoundValue(draft, field)
);

/** Typy impulzů, které smí zapsat automatický zápis. DSQ zůstává vždy ruční. */
export const AUTO_WRITE_TYPES = new Set(['TIME', 'DNF', 'DNS']);

/**
 * Smí se událost zapsat automaticky (bez kliknutí)?
 *
 * Jen nevyřízená událost s právě jedním kandidátem. Všechno ostatní - dres
 * mimo startovku, chybějící dres, víc kandidátů, nerozpoznaný řádek,
 * nepodporovaný typ, přerušené ukládání - zůstává ruční. Obsazenost kola
 * a platnost času se kontrolují až při zápisu, nad aktuálním draftem.
 */
export const isAutoWriteCandidate = (event) => (
  event?.status === 'pending'
  && event.reason === 'ready'
  && event.selectedEntryId != null
  && Array.isArray(event.candidateEntryIds)
  && event.candidateEntryIds.length === 1
  && AUTO_WRITE_TYPES.has(String(event.type || '').toUpperCase())
);

/**
 * Odpovídá kolo pořád tomu, co do něj automatický zápis dal?
 *
 * Když ne, hodnotu mezitím někdo změnil a zamítnutí ji nesmí potichu přepsat.
 */
export const roundMatchesAutoWrite = (current, autoWrite) => {
  if (!current || !autoWrite) return false;
  const { field, value } = autoWrite;
  const now = current[field];
  const nowEmpty = now === null || now === undefined || String(now).trim() === '';
  const wantEmpty = value === null || value === undefined || String(value).trim() === '';
  if (nowEmpty !== wantEmpty) return false;
  if (!nowEmpty && Math.abs(parseFloat(now) - parseFloat(value)) > 0.001) return false;
  return Boolean(current.dnf) === Boolean(autoWrite.dnf)
    && Boolean(current.dns) === Boolean(autoWrite.dns)
    && Boolean(current.dsq) === Boolean(autoWrite.dsq);
};
