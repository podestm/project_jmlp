// Sady startovních čísel (TkCisla): čisté výpočty pro obrazovku.

/** Čísla sady po desítkách – řádky mřížky (1–10, 11–20…). */
export const chunkByTen = (numbers) => {
  const rows = [];
  for (let i = 0; i < numbers.length; i += 10) rows.push(numbers.slice(i, i + 10));
  return rows;
};

/** Náhled nové sady: dresy od–do → systém od–do a počet kusů, nebo null. */
export const newSetPreview = ({ actual_from: from, actual_to: to, display_from: displayFrom }) => {
  if (!from || !to || !displayFrom) return null;
  const count = parseInt(to) - parseInt(from) + 1;
  return {
    actualFrom: from,
    actualTo: to,
    displayFrom,
    displayTo: parseInt(displayFrom) + (parseInt(to) - parseInt(from)),
    count,
  };
};

/** Aktivní čísla sady – ze souhrnu serveru, starší odpověď má jen `count`. */
export const activeCountOf = (set) => set.active_count ?? set.count;

/** Souhrn nad všemi sadami do pásky. */
export const setsSummary = (sets) => ({
  sets: sets.length,
  total: sets.reduce((sum, set) => sum + (set.count || 0), 0),
  active: sets.reduce((sum, set) => sum + (activeCountOf(set) || 0), 0),
});
