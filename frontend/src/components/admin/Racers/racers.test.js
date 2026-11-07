import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTER, categoryOptions, emptyRacerForm, filterRacers, racerDetails, racerInitials, racerName,
  racerPayload, racerToForm,
} from './racers.js';

const RACERS = [
  { id: 1, firstName: 'Matyáš', lastName: 'Novák', sex: 1, birthYear: 2013, club_id: 5, category_id: 3, idSlcr: '204118', club_name: 'SKI KLUB JUNIOR BRNO', category_name: 'Starší žáci' },
  { id: 2, firstName: 'Eliška', lastName: 'Nováková', sex: 2, birthYear: 2016, club_id: 5, category_id: 4, idSlcr: null, club_name: 'SKI KLUB JUNIOR BRNO', category_name: 'Předžačky' },
  { id: 3, firstName: 'Ondřej', lastName: 'Říha', sex: 1, birthYear: 2012, club_id: null, category_id: 3, idSlcr: '203961', club_name: null, category_name: null },
];

describe('závodníci – čisté funkce', () => {
  it('filtruje podle klubu, kategorie, pohlaví a hledá ve jméně i SLČR', () => {
    expect(filterRacers(RACERS, { ...EMPTY_FILTER, club: '5' }, '').map((r) => r.id)).toEqual([1, 2]);
    expect(filterRacers(RACERS, { ...EMPTY_FILTER, category: '3', sex: '1' }, '').map((r) => r.id)).toEqual([1, 3]);
    expect(filterRacers(RACERS, EMPTY_FILTER, 'NOVÁK').map((r) => r.id)).toEqual([1, 2]);
    expect(filterRacers(RACERS, EMPTY_FILTER, '2039').map((r) => r.id)).toEqual([3]);
    expect(filterRacers(RACERS, { ...EMPTY_FILTER, sex: '2' }, 'říha')).toEqual([]);
  });

  it('prázdný klub posílá jako null, ne jako prázdný řetězec', () => {
    expect(racerPayload({ ...emptyRacerForm(), club_id: '' }).club_id).toBeNull();
    expect(racerPayload({ ...emptyRacerForm(), club_id: '7' }).club_id).toBe(7);
  });

  it('předvyplní formulář z existujícího závodníka', () => {
    expect(racerToForm(RACERS[2])).toEqual({
      firstName: 'Ondřej', lastName: 'Říha', sex: 1, birthYear: 2012, club_id: '', idSlcr: '203961',
    });
  });

  it('popisky kategorií jako na serveru a údaje závodníka', () => {
    expect(categoryOptions([
      { id: 1, name: 'Žáci', sex: 1 },
      { id: 2, name: 'Žáci', sex: 2 },
      { id: 3, name: 'X', display_name: 'Předžačky' },
    ]).map((o) => o.label)).toEqual(['Žáci - Muži', 'Žáci - Ženy', 'Předžačky']);
    expect(racerName(RACERS[0])).toBe('Novák Matyáš');
    expect(racerInitials(RACERS[0])).toBe('NM');
    expect(racerDetails(RACERS[2])).toBe('2012 · Muž · Bez klubu · SLČR 203961');
    expect(racerDetails(RACERS[1])).toBe('2016 · Žena · SKI KLUB JUNIOR BRNO · Předžačky · bez SLČR');
  });
});
