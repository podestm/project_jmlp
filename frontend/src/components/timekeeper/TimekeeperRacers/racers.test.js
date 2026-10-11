import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, categoryOptionsOf, clubOptionsOf, filterEntries, getSexLabel, getSexLetter, isFiltered } from './racers.js';

const entries = [
  { id: 1, racer_name: 'Ema', racer_surname: 'Dvořáková', club_name: 'SK Meteor', category_id: 3, category_name: 'Přípravka dívky', racer_sex: 2, race_number_actual: 31 },
  { id: 2, racer_name: 'Jakub', racer_surname: 'Novák', club_name: 'Ski klub Victoria', category_id: null, category_name: null, racer_sex: 1, race_number_actual: 18 },
  { id: 3, racer_name: 'Adam', racer_surname: 'Černý', club_name: 'Ski klub Victoria', category_id: 4, category_name: 'Předžáci', racer_sex: 1 },
];

describe('závodníci závodu', () => {
  it('popisky pohlaví', () => {
    expect(getSexLabel(1)).toBe('Muž');
    expect(getSexLabel('2')).toBe('Žena');
    expect(getSexLetter(2)).toBe('Ž');
    expect(getSexLetter(null)).toBe('?');
  });

  it('volby filtrů', () => {
    expect(clubOptionsOf(entries)).toEqual(['SK Meteor', 'Ski klub Victoria']);
    expect(categoryOptionsOf(entries)).toEqual(['Přípravka dívky', 'Bez kategorie', 'Předžáci']);
  });

  it('filtruje podle oddílu, kategorie, pohlaví a textu', () => {
    expect(filterEntries(entries, EMPTY_FILTERS)).toHaveLength(3);
    expect(filterEntries(entries, { ...EMPTY_FILTERS, club: 'Ski klub Victoria' }).map((e) => e.id)).toEqual([2, 3]);
    expect(filterEntries(entries, { ...EMPTY_FILTERS, category: 'Bez kategorie' }).map((e) => e.id)).toEqual([2]);
    expect(filterEntries(entries, { ...EMPTY_FILTERS, sex: '2' }).map((e) => e.id)).toEqual([1]);
    expect(filterEntries(entries, { ...EMPTY_FILTERS, text: ' 18 ' }).map((e) => e.id)).toEqual([2]);
    expect(isFiltered(EMPTY_FILTERS)).toBe(false);
    expect(isFiltered({ ...EMPTY_FILTERS, text: 'x' })).toBe(true);
  });
});
