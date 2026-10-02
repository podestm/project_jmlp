import { describe, expect, it } from 'vitest';
import { buildStartListDoc } from './startList.js';
import { pagesOf, textsOf } from './testHelpers.js';

const header = {
  cupName: 'Jihomoravský lyžařský pohár',
  editionLabel: 'XX.',
  raceNumberLabel: '2026-01',
  organizerName: 'FreeSki Academy Brno',
  raceDate: '2026-10-03'
};

const entry = (n, overrides = {}) => ({
  number: n, points: null, slcrId: n % 2 ? null : `89${String(n).padStart(4, '0')}`, surname: `Příjmení${n}`,
  firstName: 'Jméno', club: 'Ski team Victoria Brno', nation: 'CZE', year: 2019, ...overrides
});

describe('startovní listina jako z LiZy', () => {
  it('má hlavičku závodu jen na první stránce a nadpis kola na každé', () => {
    const doc = buildStartListDoc({
      header,
      categories: [{ name: 'Myšáci dívky', entries: Array.from({ length: 45 }, (_, i) => entry(i + 1)) }]
    });
    const pages = pagesOf(doc);
    expect(pages).toHaveLength(2);
    expect(pages[0].map((t) => t.text)).toContain('ČÍSLO ZÁVODU:');
    expect(pages[1].map((t) => t.text)).not.toContain('ČÍSLO ZÁVODU:');
    pages.forEach((page) => expect(page.map((t) => t.text)).toContain('STARTOVNÍ LISTINA 1. KOLA'));
    expect(pages[0].find((t) => t.text === '03.10.2026')).toBeTruthy();
  });

  it('řádky po 20,16 b, číslo odsazené čtyřmi mezerami, registrační číslo ve vlastním sloupci', () => {
    const doc = buildStartListDoc({ header, categories: [{ name: 'Myšáci dívky', entries: [entry(1), entry(2)] }] });
    const page = pagesOf(doc)[0];
    const first = page.find((t) => t.text === 'Příjmení1');
    const second = page.find((t) => t.text === 'Příjmení2');
    // Měřeno z LiZy: první příjmení má účaří 211,56, další o 20,16 níž.
    expect(first.base).toBeCloseTo(211.56, 2);
    expect(second.base - first.base).toBeCloseTo(20.16, 2);
    expect(page.map((t) => t.text)).toContain('    2');
    // Registrační číslo nesmí být ve sloupci Body (x 79,2) - plete se s body.
    expect(page.find((t) => t.text === '890002').x).toBeCloseTo(507, 2);
    expect(page.map((t) => t.text)).toContain('ID závodníka');
  });

  it('nadpis 2. kola a patička na každé stránce', () => {
    const doc = buildStartListDoc({ header, round: 2, categories: [{ name: 'OPEN muži', entries: [entry(97)] }] });
    const texts = textsOf(doc);
    expect(texts).toContain('STARTOVNÍ LISTINA 2. KOLA');
    expect(texts).toContain('Strana:');
    expect(texts).toContain('Zpracováno systémem jmlp.cz');
  });

  it('prázdné kategorie se netisknou', () => {
    const doc = buildStartListDoc({ header, categories: [{ name: 'Junioři', entries: [] }, { name: 'OPEN ženy', entries: [entry(5)] }] });
    const texts = textsOf(doc);
    expect(texts).not.toContain('Junioři');
    expect(texts).toContain('OPEN ženy');
  });
});
