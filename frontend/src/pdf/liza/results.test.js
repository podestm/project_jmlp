import { describe, expect, it } from 'vitest';
import { buildResultsDoc } from './results.js';
import { imagesOf, pagesOf, textsOf } from './testHelpers.js';

const header = {
  cupName: 'Jihomoravský lyžařský pohár', editionLabel: 'XIX.', raceNumberLabel: '2025-05',
  organizerName: 'FREE SKI ACADEMY', raceDate: '2026-02-07', arealName: 'Olešnice',
  raceDirector: 'Markéta Slováčková', technicalDelegate: 'Roman Keznikl', chiefTimekeeper: 'Ivo Podešť',
  runs: [{ run_number: 1, gates_count: 15, conditions: 'zataženo', start_time: '10:00', course_length_m: 320 },
    { run_number: 2, gates_count: 16, conditions: 'jasno', start_time: '12:00' }]
};

const finisher = (rank, overrides = {}) => ({
  rank, surname: `Závodník${rank}`, firstName: 'Jméno', bib: rank, year: 2018, club: 'KSLBTL', nation: 'CZE',
  time1: 30 + rank, time2: null, total: 30 + rank, diff: rank === 1 ? null : rank, points: [100, 80, 60][rank - 1] || 1, ...overrides
});

describe('výsledková listina jako z LiZy', () => {
  it('celková listina jednoho kola: hlavička, pořadí, součet, ztráta a body', () => {
    const doc = buildResultsDoc({
      header,
      categories: [{ name: 'Myšáci dívky', entries: [finisher(1), finisher(2), { surname: 'Rohovská', status: 'DSQ', bib: 7 }] }]
    });
    const page = pagesOf(doc)[0];
    const texts = page.map((t) => t.text);
    expect(texts).toEqual(expect.arrayContaining(['CELKOVÁ VÝSLEDKOVÁ LISTINA', '2025-05', 'FREE SKI ACADEMY', '07.02.26 Olešnice', 'Markéta Slováčková', '320m', '1.KOLO']));
    expect(texts).not.toContain('2.kolo');
    expect(texts).toEqual(expect.arrayContaining(['  1', '  2', 'DSQ', '31,00', '+2,00', '100', '80']));
    // Měřeno z LiZy: první řádek - příjmení s účařím 355,56, pořadí 359,16.
    expect(page.find((t) => t.text === 'Závodník1').base).toBeCloseTo(355.56, 2);
    expect(page.find((t) => t.text === '  1').base).toBeCloseTo(359.16, 2);
  });

  it('dvě kola: sloupec 2. kola a údaje 2. kola v hlavičce', () => {
    const doc = buildResultsDoc({
      header, runCount: 2,
      categories: [{ name: 'Junioři', entries: [finisher(1, { time1: 30, time2: 31, total: 61 })] }]
    });
    const texts = textsOf(doc);
    expect(texts).toEqual(expect.arrayContaining(['2.kolo', '2.KOLO', '31,00', '01:01,00', 'jasno', '12:00']));
  });

  it('listina kola: jen čas toho kola, bez součtu a bodů', () => {
    const doc = buildResultsDoc({
      header, runCount: 2, mode: 'run', run: 2,
      categories: [{ name: 'Junioři', entries: [finisher(1, { time1: 30, time2: 31, total: 31 })] }]
    });
    const texts = textsOf(doc);
    expect(texts).toContain('VÝSLEDKOVÁ LISTINA 2.KOLA');
    expect(texts).toContain('31,00');
    expect(texts).not.toContain('30,00');
    expect(texts).not.toContain('PT');
    expect(texts).not.toContain('100');
  });

  it('průběžná listina je bez hlavičky závodu', () => {
    const doc = buildResultsDoc({ header: null, mode: 'interim', categories: [{ name: 'Junioři', entries: [finisher(1)] }] });
    const texts = textsOf(doc);
    expect(texts).toContain('PRŮBĚŽNÁ VÝSLEDKOVÁ LISTINA');
    expect(texts).not.toContain('ČÍSLO ZÁVODU:');
  });

  it('pruh sponzorů se vytiskne pod posledním řádkem', () => {
    const sponsors = { dataUrl: 'data:image/png;base64,AAAA', width: 700, height: 100 };
    const doc = buildResultsDoc({ header: { ...header, sponsors }, categories: [{ name: 'Junioři', entries: [finisher(1)] }] });
    expect(imagesOf(doc).some((img) => img.image === sponsors.dataUrl)).toBe(true);
  });
});
