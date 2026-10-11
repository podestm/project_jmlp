// Application Constants
export const APP_CONFIG = {
  NAME: 'JMLP',
  FULL_NAME: 'Jihomoravský lyžařský pohár',
  DESCRIPTION: 'Oficiální webové stránky Jihomoravského lyžařského poháru'
};

// Date and Time Configuration
export const DATE_CONFIG = {
  LOCALE: 'cs-CZ',
  DATE_FORMAT: {
    SHORT: { day: '2-digit', month: '2-digit', year: 'numeric' },
    LONG: {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    },
    // Same as LONG without the weekday - used across the timekeeper screens.
    LONG_NO_WEEKDAY: { day: 'numeric', month: 'long', year: 'numeric' },
    MONTH_YEAR: { month: 'long', year: 'numeric' }
  },
  DATE_TIME_FORMAT: {
    SHORT: {
      day: 'numeric', month: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }
  },
  TIME_FORMAT: {
    SHORT: { hour: '2-digit', minute: '2-digit' },
    LONG: { hour: '2-digit', minute: '2-digit', second: '2-digit' }
  }
};

// Season Configuration
// season_id is the START year of the season: 2025 = 1.8.2025 - 31.7.2026.
// The backend (backend/app/utils.py) and fuj_jmlp_race.season_id use the same
// convention - keep the three in step.
export const SEASON_CONFIG = {
  SEASON_START_MONTH: 8, // srpen
  SEASON_START_DAY: 1,

  seasonIdForDate: (referenceDate = new Date()) => {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth() + 1; // JavaScript months jsou 0-indexed

    // Od srpna patříme do sezóny aktuálního roku, jinak do sezóny předchozí.
    return month >= SEASON_CONFIG.SEASON_START_MONTH ? year : year - 1;
  },

  formatSeason: (seasonId) => `${seasonId}/${seasonId + 1}`,

  getSeasonPeriod: (seasonId) => ({
    start: `1.8.${seasonId}`,
    end: `31.7.${seasonId + 1}`
  })
};

export const MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];
