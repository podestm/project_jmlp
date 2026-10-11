import { describe, expect, it } from 'vitest';
import { collectExtensions, defaultSeason, hasFilters, EMPTY_FILTERS, seasonChoices, usageLabel } from './documents.js';

const SEASONS = [
  { year_start: 2027, season_label: '2027/2028', edition_label: 'XXI.', active: false, documents_count: 0 },
  { year_start: 2026, season_label: '2026/2027', edition_label: 'XX.', active: true, documents_count: 2 },
  { year_start: 2025, season_label: '2025/2026', edition_label: null, active: false, documents_count: 7 },
  { year_start: 2024, season_label: '2024/2025', edition_label: 'XVIII.', active: false, documents_count: 1 },
  { year_start: 2023, season_label: '2023/2024', edition_label: 'XVII.', active: false, documents_count: 1 },
];

describe('knihovna dokumentů', () => {
  it('filtry: prázdné nejsou aktivní', () => {
    expect(hasFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasFilters({ ...EMPTY_FILTERS, q: 'řád' })).toBe(true);
  });

  it('přípony z dat bez duplicit a seřazené', () => {
    expect(collectExtensions([{ original_filename: 'a.PDF' }, { original_filename: 'b.jpg' }, { original_filename: 'c.pdf' }, { original_filename: 'x' }]))
      .toEqual(['jpg', 'pdf']);
  });

  it('štítek použití nese stav slovy', () => {
    expect(usageLabel({ type: 'Sezóna', published: true })).toBe('Sezóna · zveřejněno');
    expect(usageLabel({ type: 'Článek', published: false })).toBe('Článek · skryto');
  });

  it('nabídne čtyři nejnovější sezóny, výchozí je aktivní', () => {
    const choices = seasonChoices(SEASONS);
    expect(choices).toHaveLength(4);
    expect(choices[1]).toEqual({ value: 2026, seasonLabel: '2026/2027', label: '2026/2027 · XX. ročník', description: 'aktuální sezóna · teď 2 dokumenty' });
    expect(choices[2].label).toBe('2025/2026');
    expect(choices[3].description).toBe('teď 1 dokument');
    expect(defaultSeason(SEASONS)).toBe(2026);
    expect(defaultSeason([])).toBeNull();
  });
});
