import { describe, expect, it } from 'vitest';
import {
  buildResultsDoc,
  categoryRunCount,
  resultsFileName,
  RUN_MODE_SUM,
  TITLE_INTERIM
} from './resultsPdf.js';

/**
 * Počet kol není vlastnost závodu: jedna kategorie může jet obě kola a jiná
 * jen jedno. Listina se proto řídí naměřenými daty každé kategorie zvlášť
 * a kola jde vytisknout i samostatně.
 */

const entry = (overrides = {}) => ({
  id: 1,
  start_number: 1,
  racer_name: 'Jan',
  racer_surname: 'Novák',
  racer_year: 2010,
  club_name: 'SK Test',
  status: null,
  time1: 60,
  time2: null,
  time_sum: 60,
  display_rank: 1,
  display_points: 100,
  display_diff: null,
  ...overrides
});

const category = (name, entries) => ({ category_name: name, entries });

// Tabulky kategorií - nadpis a hlavičkový pás jsou taky tabulky, poznají se
// podle toho, že nemají opakovanou dvouřádkovou hlavičku.
const categoryTables = (doc) => doc.content.filter((node) => node.table?.headerRows === 2);

/** Hlavičky sloupců každé kategorie, v pořadí, jak jsou v listině. */
const columnHeaders = (doc) => categoryTables(doc)
  .map((node) => node.table.body[0].map((cell) => cell.text));

const dataRows = (doc) => categoryTables(doc).map((node) => node.table.body.slice(2));

describe('buildResultsDoc - sloupce podle dat kategorie', () => {
  it('kategorie s jedním naměřeným kolem nemá sloupec 2.kolo', () => {
    const doc = buildResultsDoc({ categories: [category('U10 dívky', [entry()])] });

    expect(columnHeaders(doc)[0]).not.toContain('2.kolo');
    expect(columnHeaders(doc)[0]).toContain('Součet');
  });

  it('kategorie s druhým kolem sloupec 2.kolo má', () => {
    const doc = buildResultsDoc({
      categories: [category('OPEN muži', [entry({ time2: 62, time_sum: 122 })])]
    });

    expect(columnHeaders(doc)[0]).toContain('2.kolo');
  });

  it('každá kategorie si nese svůj počet kol v jedné listině', () => {
    const doc = buildResultsDoc({
      categories: [
        category('U10 dívky', [entry()]),
        category('OPEN muži', [entry({ id: 2, time2: 62, time_sum: 122 })])
      ]
    });

    const [prvni, druha] = columnHeaders(doc);
    expect(prvni).not.toContain('2.kolo');
    expect(druha).toContain('2.kolo');
  });

  it('categoryRunCount čte počet kol z dat, ne z nastavení závodu', () => {
    expect(categoryRunCount(category('A', [entry()]))).toBe(1);
    expect(categoryRunCount(category('A', [entry(), entry({ id: 2, time2: 61 })]))).toBe(2);
    expect(categoryRunCount(category('A', []))).toBe(1);
  });
});

describe('buildResultsDoc - listina jednoho kola', () => {
  it('1. kolo má sloupec kola a nemá součet', () => {
    const doc = buildResultsDoc({
      categories: [category('U10 dívky', [entry({ time2: 62, time_sum: 122 })])],
      runMode: '1'
    });

    expect(columnHeaders(doc)[0]).toEqual(
      ['Pořadí', 'Jméno', 'st.č.', 'ročník', 'Startuje za', 'Stát', '1.kolo', 'DIF', 'PT']
    );
  });

  it('2. kolo tiskne čas druhé jízdy', () => {
    const doc = buildResultsDoc({
      categories: [category('U10 dívky', [entry({ time1: 60, time2: 62.5, time_sum: 122.5 })])],
      runMode: '2'
    });

    expect(columnHeaders(doc)[0]).toContain('2.kolo');
    const radek = dataRows(doc)[0][0];
    expect(radek.map((cell) => cell.text)).toContain('62,50');
    expect(radek.map((cell) => cell.text)).not.toContain('60,00');
  });

  it('nadpis pojmenuje kolo', () => {
    const doc = buildResultsDoc({ categories: [category('A', [entry()])], runMode: '2' });

    expect(JSON.stringify(doc.content)).toContain('VÝSLEDKY 2. KOLA');
  });

  it('bez volby kola zůstává průběžný nadpis', () => {
    const doc = buildResultsDoc({ categories: [category('A', [entry()])] });

    expect(JSON.stringify(doc.content)).toContain(TITLE_INTERIM);
  });

  it('nedokončivší má místo času stav i v listině kola', () => {
    const doc = buildResultsDoc({
      categories: [category('A', [entry({ status: 'DNF', display_rank: null, display_points: 0 })])],
      runMode: '1'
    });

    expect(dataRows(doc)[0][0].map((cell) => cell.text)).toContain('DNF');
  });
});

describe('buildResultsDoc - hlavička', () => {
  const header = (runs) => ({
    raceNumberLabel: '2026-01',
    runs
  });

  it('nevyplněné kolo se do hlavičky netiskne', () => {
    const doc = buildResultsDoc({
      header: header([
        { run_number: 1, course_setter: 'Stavitel A' },
        { run_number: 2, course_setter: '', gates_count: null }
      ]),
      categories: [category('A', [entry()])]
    });

    const text = JSON.stringify(doc.content);
    expect(text).toContain('1.KOLO');
    expect(text).not.toContain('2.KOLO');
  });

  it('listina jednoho kola nese jen údaje toho kola', () => {
    const doc = buildResultsDoc({
      header: header([
        { run_number: 1, course_setter: 'Stavitel A' },
        { run_number: 2, course_setter: 'Stavitel B' }
      ]),
      categories: [category('A', [entry()])],
      runMode: '2'
    });

    const text = JSON.stringify(doc.content);
    expect(text).toContain('Stavitel B');
    expect(text).not.toContain('Stavitel A');
  });
});

describe('resultsFileName', () => {
  it('rozliší celkovou listinu, průběžnou a jednotlivá kola', () => {
    expect(resultsFileName('2026-01', false, RUN_MODE_SUM)).toBe('vysledky_2026-01.pdf');
    expect(resultsFileName('2026-01', true, RUN_MODE_SUM)).toBe('prubezne_2026-01.pdf');
    expect(resultsFileName('2026-01', true, '2')).toBe('2kolo_2026-01.pdf');
  });
});
