// Výsledky v časomíře (TkVysledky): čisté funkce nad seřazenými řádky
// z rankEntriesByTime. Pořadí samo počítá utils/results.js.


/** Ztráta na vítěze „+0.52“; vítěz „vítěz“, bez času pomlčka. */
export const formatLoss = (entry) => {
  if (entry.display_rank === 1) return 'vítěz';
  return entry.display_diff != null ? `+${entry.display_diff.toFixed(2)}` : '—';
};

/** Pořadí, která sdílí víc závodníků (stejný čas) – „Dělené 4. místo“. */
export const sharedRanks = (ranked) => {
  const counts = new Map();
  ranked.forEach((entry) => {
    if (entry.display_rank != null) counts.set(entry.display_rank, (counts.get(entry.display_rank) || 0) + 1);
  });
  return new Set([...counts].filter(([, n]) => n > 1).map(([rank]) => rank));
};

/** Má kategorie aspoň jeden zapsaný čas nebo příznak? */
export const hasAnyResult = (entries) => entries.some((entry) => (
  entry.time1 != null || entry.time2 != null || entry.time_sum != null || entry.status
));
