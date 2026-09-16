import { describe, expect, it } from 'vitest';
import { buildStartListDoc, startListFileName, TITLE_START_LIST } from './startListPdf.js';

/**
 * Startovní listina se tiskne v pořadí startu a bez časů - jediné, co rozhodčí
 * u startu potřebuje, je startovní číslo, dres, jméno, ročník a klub.
 */

const entry = (overrides = {}) => ({
  id: 1,
  start_number: 1,
  race_number_actual: 11,
  racer_name: 'Anna',
  racer_surname: 'Holčičková',
  racer_year: 2017,
  club_name: 'SK Pardubice',
  time1: 60,
  time2: 62,
  time_sum: 122,
  ...overrides
});

const category = (name, entries) => ({ category_name: name, entries });

const categoryTables = (doc) => doc.content.filter((node) => node.table?.headerRows === 2);
const columnHeaders = (doc) => categoryTables(doc).map((node) => node.table.body[0].map((c) => c.text));
const dataRows = (doc) => categoryTables(doc).map((node) => node.table.body.slice(2));

describe('buildStartListDoc', () => {
  it('má sloupce startovky a žádné časy', () => {
    const doc = buildStartListDoc({ categories: [category('Předžačky', [entry()])] });

    expect(columnHeaders(doc)[0]).toEqual(['St.č.', 'Dres', 'Jméno', 'ročník', 'Startuje za']);
    const texty = JSON.stringify(dataRows(doc)[0][0]);
    expect(texty).not.toContain('60,00');
    expect(texty).not.toContain('122');
  });

  it('vytiskne startovní číslo, dres, ročník i klub', () => {
    const doc = buildStartListDoc({ categories: [category('Předžačky', [entry({ start_number: 7, race_number_actual: 23 })])] });

    const radek = dataRows(doc)[0][0];
    expect(radek[0].text).toBe('7');
    expect(radek[1].text).toBe('23');
    expect(JSON.stringify(radek[2])).toContain('Holčičková');
    expect(radek[3].text).toBe('2017');
    expect(radek[4].text).toBe('SK Pardubice');
  });

  it('závodník bez dresu, klubu a ročníku má prázdné buňky, ne "null"', () => {
    const doc = buildStartListDoc({
      categories: [category('OPEN muži', [
        entry({ race_number_actual: null, club_name: null, racer_year: null, start_number: null })
      ])]
    });

    const radek = dataRows(doc)[0][0];
    expect([radek[0].text, radek[1].text, radek[3].text, radek[4].text]).toEqual(['', '', '', '']);
    expect(JSON.stringify(radek)).not.toContain('null');
  });

  it('kategorie jdou v předaném pořadí a nesou počet závodníků', () => {
    const doc = buildStartListDoc({
      categories: [
        category('Myšáci dívky', [entry()]),
        category('OPEN muži', [entry({ id: 2 }), entry({ id: 3 })])
      ]
    });

    const nadpisy = doc.content.filter((node) => node.text && node.fontSize === 12).map((node) => node.text);
    expect(nadpisy).toEqual(['Myšáci dívky (1)', 'OPEN muži (2)']);
    expect(categoryTables(doc)).toHaveLength(2);
  });

  it('bez hlavičky se vytiskne jen nadpis a tabulky (offline tisk)', () => {
    const doc = buildStartListDoc({ categories: [category('A', [entry()])] });

    expect(JSON.stringify(doc.content)).toContain(TITLE_START_LIST);
    expect(JSON.stringify(doc.content)).not.toContain('ŘEDITEL ZÁVODU');
  });

  it('s hlavičkou nese činovníky i údaje o kolech', () => {
    const doc = buildStartListDoc({
      header: {
        raceNumberLabel: '2026-01',
        raceDirector: 'Jan Ředitel',
        runs: [
          { run_number: 1, course_setter: 'Stavitel A' },
          { run_number: 2, course_setter: '' }
        ]
      },
      categories: [category('A', [entry()])]
    });

    const text = JSON.stringify(doc.content);
    expect(text).toContain('ŘEDITEL ZÁVODU');
    expect(text).toContain('Stavitel A');
    // Nevyplněné kolo se netiskne ani ve startovce.
    expect(text).not.toContain('2.KOLO');
  });
});

describe('startListFileName', () => {
  it('pojmenuje soubor podle čísla závodu', () => {
    expect(startListFileName('2026-01')).toBe('startovka_2026-01.pdf');
    expect(startListFileName(null)).toBe('startovka_zavod.pdf');
  });
});
