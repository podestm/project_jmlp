import { describe, expect, it } from 'vitest';
import { buildClubListDoc, categoryCode, groupByClub, setName } from './clubList.js';
import { pagesOf, textsOf } from './testHelpers.js';

describe('zkratky kategorií jako v LiZe', () => {
  it.each([
    ['Myšáci dívky', 2, 'MYD'], ['Myšáci chlapci', 1, 'MYH'], ['Myšáci hoši', null, 'MYH'],
    ['Přípravka dívky', 2, 'PPD'], ['přípravka chlapci', 1, 'PPH'],
    ['Předžačky', 2, 'PD'], ['předžáci chlapci', null, 'PH'],
    ['Mladší žačky', 2, 'MZD'], ['mladší žáci', 1, 'MZH'],
    ['Starší žačky', null, 'SZD'], ['Starší žáci', 1, 'SZH'],
    ['Juniorky', 2, 'JUD'], ['Junioři', 1, 'JUH'],
    ['OPEN ženy', 2, 'OZ'], ['OPEN muži', 1, 'OM']
  ])('%s -> %s', (name, sex, code) => {
    expect(categoryCode(name, sex)).toBe(code);
  });
});

describe('rozpis po klubech', () => {
  it('kluby řadí podle kódů znaků jako LiZa - velká písmena první', () => {
    const names = ['Ski klub Hranice', 'SKI Klub Hlinsko', 'Ski Team Chřiby', 'SKI KLUB JUNIOR BRNO', 'SKI Akademie Brno']
      .map((club, i) => ({ club, bib: i + 1 }));
    expect(groupByClub(names).map((c) => c.name)).toEqual([
      'SKI Akademie Brno', 'SKI KLUB JUNIOR BRNO', 'SKI Klub Hlinsko', 'Ski Team Chřiby', 'Ski klub Hranice'
    ]);
  });

  it('uvnitř klubu podle startovního čísla', () => {
    const [club] = groupByClub([{ club: 'A', bib: 20 }, { club: 'A', bib: 5 }, { club: 'A', bib: 12 }]);
    expect(club.entries.map((e) => e.bib)).toEqual([5, 12, 20]);
  });

  it('sady pojmenované řadovou číslovkou', () => {
    expect(setName(1)).toBe('První sada');
    expect(setName(2)).toBe('Druhá sada');
  });

  it('řádek "M - Příjmení Jméno", seznam sad a kategorií na samostatné stránce', () => {
    const doc = buildClubListDoc({
      header: { cupName: 'Jihomoravský lyžařský pohár', editionLabel: 'XX.', raceNumberLabel: '2026-01', raceDate: '2026-10-03' },
      entries: [
        { club: 'Adomi Race', bib: 23, setNumber: 1, sex: 1, surname: 'Vodica', firstName: 'Michael', year: 2022, categoryCode: 'MYH' },
        { club: 'FreeSki Academy Brno', bib: 5, setNumber: 1, sex: 2, surname: 'Mertová', firstName: 'Beáta', year: 2022, categoryCode: 'MYD' }
      ],
      sets: [{ number: 1, name: 'První sada' }],
      categories: [{ code: 'MYD', name: 'Myšáci dívky' }, { code: 'MYH', name: 'Myšáci hoši' }]
    });
    const pages = pagesOf(doc);
    expect(pages).toHaveLength(2);
    const first = pages[0];
    expect(first.find((t) => t.text === 'Adomi Race').base).toBeCloseTo(58.92, 2);
    expect(first.find((t) => t.text === 'M - Vodica Michael').base).toBeCloseTo(73.92, 2);
    expect(textsOf(doc)).toContain('Z - Mertová Beáta');
    expect(pages[1].map((t) => t.text)).toEqual(expect.arrayContaining(['SEZNAM SAD STARTOVNÍCH ČÍSEL', 'První sada', 'Seznam kategorií', 'MYD', 'Myšáci hoši']));
  });
});
