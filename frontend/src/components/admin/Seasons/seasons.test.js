import { describe, expect, it } from 'vitest';
import { editionPreview, seasonCounts, seasonPayload, seasonRange, seasonsMeta, seasonState, splitSeasons } from './seasons.js';

const SEASONS = [
  { year_start: 2027, edition_label: 'XXI.', races_count: 0, documents_count: 0 },
  { year_start: 2026, edition_label: 'XX.', races_count: 2, documents_count: 1 },
  { year_start: 2025, edition_label: 'XIX.', races_count: 7, documents_count: 5 },
];

describe('sezóny', () => {
  it('rozdělí běžící a připravené od archivu', () => {
    const { upcoming, archive } = splitSeasons(SEASONS, 2026);
    expect(upcoming.map((s) => s.year_start)).toEqual([2027, 2026]);
    expect(archive.map((s) => s.year_start)).toEqual([2025]);
    expect(seasonState(SEASONS[0], 2026)).toBe('Připravená');
    expect(seasonState(SEASONS[1], 2026)).toBe('Aktuální sezóna');
  });

  it('texty', () => {
    expect(seasonRange(2026)).toBe('1. 8. 2026 – 31. 7. 2027');
    expect(seasonCounts(SEASONS[1])).toBe('2 závody · 1 dokument');
    expect(seasonsMeta(SEASONS, 2026)).toBe('3 ročníky v databázi · XX. ročník právě běží');
    expect(editionPreview(20)).toBe('XX.');
    expect(editionPreview('')).toBe('—');
  });

  it('rok se posílá jen u nové sezóny', () => {
    const form = { year_start: '2028', edition: '', name: 'JMLP', active: true };
    expect(seasonPayload(form, true)).toEqual({ edition: null, name: 'JMLP', active: true, year_start: 2028 });
    expect(seasonPayload(form, false)).not.toHaveProperty('year_start');
  });
});
