/**
 * Pomůcky obrazovky Párování se SLČR (SlcrPairing.jsx) - bez Reactu, ať jdou
 * otestovat samostatně.
 */

export const PAIR_STATUS = {
  suggested: 'suggested',
  confirmed: 'confirmed',
  rejected: 'rejected',
  notFound: 'not_found'
};

export const STATUS_TABS = [
  { status: PAIR_STATUS.suggested, label: 'K potvrzení' },
  { status: PAIR_STATUS.confirmed, label: 'Spárovaní' },
  { status: PAIR_STATUS.notFound, label: 'Nenalezení' },
  { status: PAIR_STATUS.rejected, label: 'Odmítnutí' }
];

/** Jistota shody: text štítku a `tone` = barva štítku i lišty řádku (vzhled v PairMatch/PairRow). */
export const CONFIDENCE = {
  high: { label: 'Jistá shoda', tone: 'high' },
  medium: { label: 'Pravděpodobná', tone: 'medium' },
  low: { label: 'Nejistá', tone: 'low' }
};

/** Barva lišty řádku: podle jistoty, nenalezení šedě. */
export const pairTone = (item) => CONFIDENCE[item.confidence]?.tone || 'none';

/** Upozornění k návrhu, jak je ukazuje tabulka. */
export function pairWarnings(item) {
  const flags = item.flags || {};
  const warnings = [];
  if (flags.code_mismatch) {
    warnings.push({ key: 'code', text: `ID závodníka je jiné (u nás ${item.racer.slcr_id}, v evidenci ${item.slcr.race_code}) - ověřte, že jde o stejného člověka` });
  }
  if (flags.shared_member) warnings.push({ key: 'shared', text: 'Stejný člen i u jiného závodníka - duplicita?' });
  return warnings;
}

const show = (value) => (value == null || value === '' ? '–' : String(value));

/**
 * Co potvrzení změní v našem záznamu (evidence SLČR je zdroj pravdy pro
 * jméno, příjmení, ročník a ID závodníka), např. "jméno Ema → Emma".
 */
export function changeLabels(item) {
  return (item.changes || []).map((change) => `${change.label} ${show(change.old)} → ${show(change.new)}`);
}

/** Co se při potvrzení už převzalo (u potvrzených): "ročník byl 2016". */
export function appliedLabels(item) {
  return (item.applied || []).map((change) => `${change.label} bylo ${show(change.old)}`);
}

const fold = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Hledání v tabulce: jméno u nás i v evidenci, ID. */
export function filterPairs(items, { query = '', confidence = 'all' } = {}) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (confidence !== 'all' && item.confidence !== confidence) return false;
    if (words.length === 0) return true;
    const haystack = fold([
      item.racer.surname, item.racer.name, item.racer.year, item.racer.slcr_id,
      item.slcr?.surname, item.slcr?.name, item.slcr?.race_code
    ].join(' '));
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * Návrhy, které jde potvrdit hromadně: jistá shoda bez upozornění a bez
 * změny ročníku. Všechno ostatní má správce projít jednotlivě.
 */
export function bulkConfirmable(items) {
  return items.filter((item) => (
    item.status === PAIR_STATUS.suggested
    && item.confidence === 'high'
    && item.slcr
    && pairWarnings(item).length === 0
    // Změna ročníku přesune závodníka do jiné kategorie - jednotlivě.
    && !(item.changes || []).some((change) => change.field === 'year')
  ));
}

/** Čas posledního načtení ze SLČR („23. 9. 2026 16:05“), bez údaje pomlčka. */
export const formatSyncTime = (iso) => (iso
  ? new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

/** Průběh načítání v procentech; dokud server nezná celkový počet, 5 %. */
export const syncProgress = (job) => (job?.total ? (job.done / job.total) * 100 : 5);
