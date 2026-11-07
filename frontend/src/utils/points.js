/**
 * Bodování závodu.
 *
 * Musí zůstat v souladu s POINTS_TABLE a points_for_rank
 * v backend/app/services/results.py.
 *
 * Proč je to i na klientovi: offline se výsledky ze serveru nenačtou, takže by
 * vytištěné průběžné výsledky neměly body. Tady se dopočítají z pořadí, které
 * stejně počítáme lokálně. Na server se body uloží při publikování listiny.
 */

/** Tabulka Světového poháru FIS pro 1.–30. místo. */
export const POINTS_TABLE = [
  100, 80, 60, 50, 45, 40, 36, 32, 29, 26, 24, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
  5, 4, 3, 2, 1,
];

/**
 * Body za umístění v kategorii.
 *
 * Soutěžní řád JmLP: "Od 30. místa za každé umístění po 1 bodu" - každý, kdo
 * dojel, má aspoň bod (LiZa tak počítá: v závodě 2025-07 dostala místa 31-35
 * po bodu). Nedokončivší 0 bodů. Při shodě času dostanou oba závodníci stejné
 * pořadí, a tedy i stejné body.
 */
export const pointsForRank = (rank) => {
  if (!rank || rank < 1) return 0;
  if (rank > POINTS_TABLE.length) return 1;
  return POINTS_TABLE[rank - 1];
};
