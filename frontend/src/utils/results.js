// Pořadí a časy výsledků – čisté funkce sdílené časomírou (ResultsTable,
// tištěné listiny) a veřejným živým přenosem (/zive).
//
// Protějšek na serveru je rank_category v backend/app/services/results.py -
// musí zůstat v souladu, protože online se pořadí i body počítají tam
// a offline tady. Kanonické pořadí je to z tištěných/oficiálních výsledků:
// čas, pak stav, pak startovní číslo, pak id.
import { pointsForRank } from './points.js';
import { activeEntries } from '../components/timekeeper/startListHelpers.js';

/** Race times are always shown with two decimals; '—' when not measured. */
export const formatResultTime = (time) => (time != null ? time.toFixed(2) : '—');

const STATUS_ORDER = { DSQ: 1, DNF: 2, DNS: 3 };

/**
 * DNF/DNS/DSQ řádku startovní listiny.
 *
 * Výsledkové API posílá hotové `status`, startovní listina jen tři příznaky -
 * z rozpracované startovky se ale tiskne stejná sestava, takže se tady sjednotí.
 */
export const resultStatus = (entry) => {
  if (entry.status !== undefined) return entry.status;
  if (entry.dsq) return 'DSQ';
  if (entry.dnf) return 'DNF';
  if (entry.dns) return 'DNS';
  return null;
};

/**
 * Sort entries into finishing order and attach `display_rank`, `display_points`
 * and `display_diff` (shared rank AND shared points on a dead heat,
 * null rank for DNF/DNS/DSQ).
 *
 * The start_number → id tiebreak keeps a dead heat in a stable, deterministic
 * order so the spectator view and the official results cannot disagree.
 *
 * `timeField` přepíná, podle čeho se řadí: 'time_sum' je celkový výsledek,
 * 'time1'/'time2' je pořadí jednoho kola. Kola se tisknou zvlášť, protože
 * jedna kategorie může jet obě kola a jiná jen jedno.
 *
 * Vyřazení ze startky (isExcluded) do pořadí nepatří a vypadnou tady, ať
 * přijdou odkudkoli - pořadí i body ostatních se počítají, jako by
 * nestartovali. Tudy jde tabulka výsledků i každá tištěná výsledková listina.
 */
export const rankEntriesByTime = (entries, { timeField = 'time_sum' } = {}) => {
  const timeOf = (entry) => entry[timeField] ?? null;
  const hasTimeOf = (entry) => resultStatus(entry) == null && timeOf(entry) != null;

  const sortable = activeEntries(entries).sort((a, b) => {
    const aHasTime = hasTimeOf(a);
    const bHasTime = hasTimeOf(b);
    if (aHasTime && !bHasTime) return -1;
    if (!aHasTime && bHasTime) return 1;

    if (aHasTime && bHasTime) {
      if (timeOf(a) !== timeOf(b)) return timeOf(a) - timeOf(b);
    }

    const aStatus = STATUS_ORDER[resultStatus(a)] ?? 99;
    const bStatus = STATUS_ORDER[resultStatus(b)] ?? 99;
    if (aStatus !== bStatus) return aStatus - bStatus;

    const aStart = a.start_number ?? Number.MAX_SAFE_INTEGER;
    const bStart = b.start_number ?? Number.MAX_SAFE_INTEGER;
    if (aStart !== bStart) return aStart - bStart;
    return a.id - b.id;
  });

  let lastTime = null;
  let lastRank = 0;
  let winnerTime = null;
  return sortable.map((entry, index) => {
    const hasTime = hasTimeOf(entry);
    const time = timeOf(entry);
    let rank = null;
    if (hasTime) {
      rank = time === lastTime ? lastRank : index + 1;
      lastTime = time;
      lastRank = rank;
      if (winnerTime == null) winnerTime = time;
    }
    return {
      ...entry,
      status: resultStatus(entry),
      display_rank: rank,
      display_points: pointsForRank(rank),
      display_diff: hasTime && rank !== 1 ? time - winnerTime : null,
    };
  });
};
