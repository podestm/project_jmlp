import { describe, expect, it } from 'vitest';
import {
  formatSeason,
  formatSeasonShort,
  generateRaceNumber,
  seasonIdForDate,
  getSeasonIdForRace,
  seasonEdition,
  toRoman,
} from './season.js';
import { pointsForRank, POINTS_TABLE } from './points.js';

describe('seasonIdForDate', () => {
  it('od 1. srpna patří datum do sezóny toho roku', () => {
    expect(seasonIdForDate(new Date(2026, 7, 1))).toBe(2026);
    expect(seasonIdForDate(new Date(2026, 11, 31))).toBe(2026);
  });

  it('do 31. července patří ještě do sezóny loňské', () => {
    expect(seasonIdForDate(new Date(2026, 6, 31))).toBe(2025);
    expect(seasonIdForDate(new Date(2026, 0, 17))).toBe(2025);
  });

  it('hranice sezóny sedí na den', () => {
    expect(seasonIdForDate(new Date(2025, 6, 31))).toBe(2024);
    expect(seasonIdForDate(new Date(2025, 7, 1))).toBe(2025);
  });
});

describe('getSeasonIdForRace', () => {
  it('rozumí datu jako řetězci i jako Date', () => {
    expect(getSeasonIdForRace('2026-01-17')).toBe(2025);
    expect(getSeasonIdForRace(new Date(2025, 9, 4))).toBe(2025);
  });
});

describe('formatSeason', () => {
  it('zobrazí sezónu jako rozsah let', () => {
    expect(formatSeason(2025)).toBe('2025/2026');
  });
});

describe('generateRaceNumber', () => {
  it('první závod sezóny dostane pořadí 01', () => {
    expect(generateRaceNumber([], 2025)).toBe('JMLP2025-01');
  });

  it('naváže na nejvyšší dosud použité číslo', () => {
    const races = [
      { season_id: 2025, race_nr: 'JMLP2025-01' },
      { season_id: 2025, race_nr: 'JMLP2025-03' },
    ];
    expect(generateRaceNumber(races, 2025)).toBe('JMLP2025-04');
  });

  it('závody jiné sezóny číslování neovlivní', () => {
    const races = [{ season_id: 2024, race_nr: 'JMLP2024-09' }];
    expect(generateRaceNumber(races, 2025)).toBe('JMLP2025-01');
  });

  it('poškozené číslo závodu přeskočí místo pádu', () => {
    const races = [
      { season_id: 2025, race_nr: 'JMLP2025-XX' },
      { season_id: 2025, race_nr: 'JMLP2025-02' },
    ];
    expect(generateRaceNumber(races, 2025)).toBe('JMLP2025-03');
  });
});

describe('pointsForRank', () => {
  it('bodová tabulka má 30 míst a začíná stovkou', () => {
    expect(POINTS_TABLE).toHaveLength(30);
    expect(pointsForRank(1)).toBe(100);
    expect(pointsForRank(2)).toBe(80);
    expect(pointsForRank(30)).toBe(1);
  });

  it('od 30. místa má každý, kdo dojel, bod (soutěžní řád JmLP)', () => {
    expect(pointsForRank(31)).toBe(1);
    expect(pointsForRank(35)).toBe(1);
    expect(pointsForRank(120)).toBe(1);
  });

  it('bez pořadí je nula', () => {
    expect(pointsForRank(null)).toBe(0);
    expect(pointsForRank(0)).toBe(0);
  });
});

describe('ročník a krátký tvar sezóny', () => {
  it('sezóna 2026 je XX. ročník, 2025 XIX.', () => {
    expect(toRoman(seasonEdition(2026))).toBe('XX');
    expect(toRoman(seasonEdition(2025))).toBe('XIX');
  });

  it('krátký tvar sezóny', () => {
    expect(formatSeasonShort(2026)).toBe('2026/27');
    expect(formatSeasonShort(2099)).toBe('2099/00');
  });
});
