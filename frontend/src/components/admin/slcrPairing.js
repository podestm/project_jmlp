/**
 * Pomůcky obrazovky Doplnění ID ze SLČR (SlcrPairing.jsx) - bez Reactu, ať jdou
 * otestovat samostatně.
 */

const show = (value) => (value == null || value === '' ? '–' : String(value));

/** Co se u závodníka změnilo, např. "ID závodníka – → 890521". */
export function changeLabels(item) {
  return (item.changes || []).map((change) => `${change.label} ${show(change.old)} → ${show(change.new)}`);
}

const fold = (value) => String(value || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Hledání v seznamu: jméno u nás i v evidenci, ID. */
export function filterFilled(items, query = '') {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((item) => {
    const haystack = fold([
      item.racer.surname, item.racer.name, item.racer.year, item.racer.slcr_id,
      item.slcr?.surname, item.slcr?.name, item.slcr?.race_code
    ].join(' '));
    return words.every((word) => haystack.includes(word));
  });
}
