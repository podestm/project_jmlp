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

export const CONFIDENCE = {
  high: { label: 'Jistá shoda', className: 'bg-success' },
  medium: { label: 'Pravděpodobná', className: 'bg-warning text-dark' },
  low: { label: 'Nejistá', className: 'bg-danger' }
};

/** Upozornění k návrhu, jak je ukazuje tabulka. */
export function pairWarnings(item) {
  const flags = item.flags || {};
  const warnings = [];
  if (flags.code_mismatch) {
    warnings.push({ key: 'code', text: `ID závodníka nesouhlasí (u nás ${item.racer.slcr_id}, v evidenci ${item.slcr.race_code})` });
  }
  if (flags.code_missing) {
    warnings.push({ key: 'missing', text: `ID závodníka u nás chybí (v evidenci ${item.slcr.race_code})` });
  }
  if (flags.club_differs) warnings.push({ key: 'club', text: 'Jiný klub' });
  if (flags.shared_member) warnings.push({ key: 'shared', text: 'Stejný člen i u jiného závodníka - duplicita?' });
  return warnings;
}

const fold = (value) => String(value || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Hledání v tabulce: jméno u nás i v evidenci, klub, ID. */
export function filterPairs(items, { query = '', confidence = 'all' } = {}) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (confidence !== 'all' && item.confidence !== confidence) return false;
    if (words.length === 0) return true;
    const haystack = fold([
      item.racer.surname, item.racer.name, item.racer.year, item.racer.club, item.racer.slcr_id,
      item.slcr?.surname, item.slcr?.name, item.slcr?.club, item.slcr?.race_code
    ].join(' '));
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * Návrhy, které jde potvrdit hromadně: jistá shoda bez jakéhokoli upozornění.
 * Všechno ostatní má správce projít jednotlivě.
 */
export function bulkConfirmable(items) {
  return items.filter((item) => (
    item.status === PAIR_STATUS.suggested
    && item.confidence === 'high'
    && item.slcr
    && pairWarnings(item).length === 0
  ));
}
