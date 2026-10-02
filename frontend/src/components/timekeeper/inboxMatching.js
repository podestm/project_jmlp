// Překlad impulzu z časomíry na závodníka.
//
// Jediné místo, kde se to počítá. Dokud si řádek inboxu hledal kandidáty sám,
// uměl zobrazit jednoho závodníka a ✓ zapsat čas jinému.

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
 * Vyřazený ze startky kandidátem není nikdy - jinak by mu ✓ zapsal čas, který
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
 * Komu ✓ na daném řádku inboxu zapíše.
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
