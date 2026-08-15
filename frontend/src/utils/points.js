/**
 * Bodování závodu.
 *
 * Musí zůstat v souladu s POINTS_TABLE a points_for_rank
 * v backend/app/services/results.py.
 *
 * Proč je to i na klientovi: offline se "Vypočítat body" neprovede (ta cesta
 * není v applyLocalMutation), takže by vytištěné průběžné výsledky měly staré
 * nebo žádné body. Tady se dopočítají z pořadí, které stejně počítáme lokálně.
 */

/** Tabulka Světového poháru FIS pro 1.–30. místo. */
export const POINTS_TABLE = [
  100, 80, 60, 50, 45, 40, 36, 32, 29, 26,
  24, 22, 20, 18, 16, 15, 14, 13, 12, 11,
  10, 9, 8, 7, 6, 5, 4, 3, 2, 1
];

/**
 * Body za umístění v kategorii. Od 31. místa a pro nedokončivší 0 bodů.
 * Při shodě času dostanou oba závodníci stejné pořadí, a tedy i stejné body.
 */
export const pointsForRank = (rank) => {
  if (!rank || rank < 1 || rank > POINTS_TABLE.length) return 0;
  return POINTS_TABLE[rank - 1];
};
