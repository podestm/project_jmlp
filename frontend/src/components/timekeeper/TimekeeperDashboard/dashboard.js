// Výběr závodu časomíry (TkVyberZavodu): čisté funkce nad GET /api/timekeeper/races.
import { raceDate, startOfToday } from '../../../utils/races.js';

/**
 * Nadcházející (od dneška včetně, nejbližší první) a proběhlé závody
 * (nejnovější první). Závod bez data patří mezi proběhlé.
 */
export const splitRaces = (races, today = startOfToday()) => {
  const upcoming = [];
  const past = [];
  races.forEach((race) => {
    const date = raceDate(race);
    (date && date >= today ? upcoming : past).push(race);
  });
  const byDate = (a, b) => raceDate(a) - raceDate(b);
  upcoming.sort(byDate);
  past.sort((a, b) => (raceDate(b) ?? 0) - (raceDate(a) ?? 0));
  return { upcoming, past };
};

/** Závod se jede dnes? */
export const isRaceToday = (race, today = startOfToday()) => {
  const date = raceDate(race);
  return Boolean(date) && date.getTime() === today.getTime();
};
