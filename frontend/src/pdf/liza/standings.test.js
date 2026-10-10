import { describe, expect, it } from 'vitest';
import { buildStandingsDoc, COUNTED_PREP, COUNTED_SNOW, raceColumns } from './standings.js';
import { imagesOf, pagesOf, textsOf } from './testHelpers.js';
import { PRINT_MARGINS } from './layout.js';

/** Listiny jsou v souřadnicích LiZy, plátno je posune o tiskový okraj. */
const TOP = PRINT_MARGINS.top;

/*
 * Rozměry jsou změřené z pořadí, které pro JmLP vydával LIP (průběžné
 * výsledky 28. 1. a 23. 2. 2026): naše PDF z jeho dat sedí na všech stranách
 * na účaří přesně a vodorovně do 0,6 bodu, včetně linek a podbarvení.
 */
const RACES = [
  { code: 'P04.10', kind: 'P', areal_name: 'Kohoutovice' },
  { code: 'P11.10', kind: 'P', areal_name: 'Kraví Hora' },
  { code: 'P12.10', kind: 'P', areal_name: 'Areál VUT Brno' },
  { code: 'S17.01', kind: 'S', areal_name: 'Čenkovice' },
  { code: 'S07.02', kind: 'S', areal_name: 'Olešnice' },
  { code: 'S07.02', kind: 'S', areal_name: 'Olešnice' }
];

const cell = (text, kind, counted = false) => ({ text, kind, counted });

const row = (rank, surname, overrides = {}) => ({
  rank, surname, name: 'Max', year: 2019, club: 'SKI KLUB JUNIOR BRNO',
  cells: [cell('1/100', 'P', true), null, null, cell('4/50', 'S', true), cell('3/60', 'S', true), null],
  prep_points: 100, snow_points: 110, total: 210, raced_on_snow: true,
  ...overrides
});

const standings = (overrides = {}) => ({
  final: false,
  cup_name: 'Jihomoravský lyžařský pohár',
  season_label: '2025-26',
  races: RACES,
  categories: [{ name: 'myšáci hoši', rows: [row(1, 'Keznikl'), row(2, 'Janík'), row(3, 'Procházka'), row(4, 'Budín')] }],
  ...overrides
});

const fillsOf = (doc) => doc.content
  .flatMap((item) => item.canvas || [])
  .filter((shape) => shape.type === 'rect' && shape.color);

const find = (page, text) => page.find((item) => item.text === text);

describe('pořadí poháru jako od LIP', () => {
  it('záhlaví: pohár, sezóna, průběžné výsledky, datum a vysvětlivky', () => {
    const page = pagesOf(buildStandingsDoc({ standings: standings(), printedOn: '2026-02-23' }))[0];

    expect(find(page, 'Jihomoravský lyžařský pohár')).toMatchObject({ x: 144.72, base: expect.closeTo(37.8 + TOP, 2) });
    expect(find(page, '2025-26').x).toBeCloseTo(370.08, 2);
    expect(find(page, 'Průběžné výsledky')).toMatchObject({ x: 146.88 });
    expect(find(page, '23.02.2026').base).toBeCloseTo(17.4 + TOP, 2);
    expect(page.map((item) => item.text)).toContain('Výsledky z jednotlivých závodů jsou označeny písmenem');
  });

  it('sloupce závodů leží v mřížce 0,72 bodu jako u LIP', () => {
    const columns = raceColumns(7);
    expect(columns.map((column) => Number(column.left.toFixed(2))))
      .toEqual([331.2, 364.32, 398.16, 431.28, 464.4, 497.52, 531.36]);
    expect(columns.map((column) => Number(column.head.toFixed(2))))
      .toEqual([331.92, 365.76, 398.88, 432, 465.12, 498.96, 532.08]);
  });

  it('řádek: pořadí, tučná první tři jména, buňky pořadí/body, součty', () => {
    const doc = buildStandingsDoc({ standings: standings() });
    const page = pagesOf(doc)[0];

    // První řádek měřený z LIP: účaří 133,68, jméno o 0,12 níž, pořadí zarovnané doprava na 42,5.
    expect(find(page, 'Keznikl Max')).toMatchObject({ x: 48.96, bold: true, base: expect.closeTo(133.8 + TOP, 2) });
    expect(find(page, 'Budín Max')).toMatchObject({ bold: false, base: expect.closeTo(170.4 + TOP, 2) });
    expect(find(page, '2019').x).toBeCloseTo(193.92, 2);
    expect(page.filter((item) => item.text === '210' && item.bold)).toHaveLength(4);

    const fills = fillsOf(doc);
    expect(fills.filter((shape) => shape.color === COUNTED_PREP)).toHaveLength(4);
    expect(fills.filter((shape) => shape.color === COUNTED_SNOW)).toHaveLength(8);
    expect(fills[0].x).toBeCloseTo(331.2, 2);
    expect(fills[0].w).toBeCloseTo(31.68, 2);
  });

  it('kdo jel jen přípravné závody: v průběžném pořadí body obyčejně, v celkovém bez součtu', () => {
    const prepOnly = row(null, 'Holop', {
      cells: [cell('2/80', 'P'), cell('1/100', 'P', true), null, null, null, null],
      prep_points: 180, snow_points: 0, total: 100, raced_on_snow: false
    });
    const noPoints = row(null, 'Svoboda', {
      cells: [null, null, null, cell('DSQ', 'S', true), null, null],
      prep_points: 0, snow_points: 0, total: 0, raced_on_snow: true
    });
    const category = { name: 'myšáci hoši', rows: [row(1, 'Keznikl'), row(2, 'Janík'), row(3, 'Procházka'), noPoints, prepOnly] };

    // Součet započtených bodů je ve velikosti 9,96 (součty přípr./sníh. mají 8,04).
    const totals = (page, text) => page.filter((item) => item.text === text && item.size === 9.96);

    const interim = pagesOf(buildStandingsDoc({ standings: standings({ categories: [category] }) }))[0];
    expect(totals(interim, '100').map((item) => item.bold)).toEqual([false]);

    const final = pagesOf(buildStandingsDoc({ standings: standings({ final: true, categories: [category] }) }))[0];
    expect(totals(final, '100')).toEqual([]);
    expect(totals(final, '0').map((item) => item.bold)).toEqual([true]);
    expect(final.map((item) => item.text)).toContain('Celkové výsledky');
  });

  it('celkové výsledky mají logo svazu, průběžné ne', () => {
    const logo = { dataUrl: 'data:image/png;base64,AAAA', width: 800, height: 800 };
    expect(imagesOf(buildStandingsDoc({ standings: standings(), logo }))).toHaveLength(0);
    expect(imagesOf(buildStandingsDoc({ standings: standings({ final: true }), logo }))).toHaveLength(1);
  });

  it('pod pořadím seznam zpracovaných závodů, po pěti do sloupce', () => {
    const page = pagesOf(buildStandingsDoc({ standings: standings() })).at(-1);

    const title = find(page, 'Zpracované výsledky ze závodů:');
    const legend = page.filter((item) => item.base > title.base);
    const sixth = legend.filter((item) => item.text === 'S07.02').sort((a, b) => a.x - b.x).at(-1);
    expect(sixth.x).toBeCloseTo(174.96, 2);
    expect(sixth.base).toBeCloseTo(title.base + 13.8, 2);
    expect(find(legend, 'Kohoutovice').x).toBeCloseTo(48.96, 2);
  });

  it('dlouhá kategorie pokračuje na další stránce pod záhlavím sloupců', () => {
    const rows = Array.from({ length: 60 }, (_, index) => row(index + 1, `Závodník${index + 1}`));
    const pages = pagesOf(buildStandingsDoc({ standings: standings({ categories: [{ name: 'Junioři', rows }] }) }));

    expect(pages).toHaveLength(2);
    expect(pages[1].map((item) => item.text)).toContain('jméno a ročník');
    // Pokračování začíná rovnou řádkem na účaří 26,40 (měřeno z LIP).
    const first = pages[1].filter((item) => /^Závodník/.test(item.text)).sort((a, b) => a.base - b.base)[0];
    expect(first.base).toBeCloseTo(26.4 + TOP, 2);
    expect(textsOf(buildStandingsDoc({ standings: standings() }))).toContain('Zpracováno systémem jmlp.cz');
  });
});
