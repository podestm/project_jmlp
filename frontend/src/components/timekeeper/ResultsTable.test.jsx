import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResultsTable, { formatResultTime, rankEntriesByTime, resultStatus } from './ResultsTable.jsx';

/**
 * Pořadí je jediná věc, kterou počítá klient i server (rank_category
 * v backend/app/services/results.py). Rozejít se nesmí - jinak by na plátně
 * svítilo jiné pořadí než ve vytištěné listině.
 */
const entry = (overrides) => ({
  id: 1,
  start_number: 1,
  status: null,
  time_sum: null,
  racer_name: 'Jan',
  racer_surname: 'Novák',
  ...overrides
});

describe('rankEntriesByTime - pořadí', () => {
  it('řadí podle celkového času vzestupně', () => {
    const ranked = rankEntriesByTime([
      entry({ id: 1, time_sum: 62.0 }),
      entry({ id: 2, time_sum: 60.5 }),
      entry({ id: 3, time_sum: 61.2 })
    ]);

    expect(ranked.map((e) => e.id)).toEqual([2, 3, 1]);
    expect(ranked.map((e) => e.display_rank)).toEqual([1, 2, 3]);
  });

  it('závodníci bez času jdou za ty s časem', () => {
    const ranked = rankEntriesByTime([
      entry({ id: 1, status: 'DNF' }),
      entry({ id: 2, time_sum: 60.5 })
    ]);

    expect(ranked[0].id).toBe(2);
    expect(ranked[1].display_rank).toBeNull();
  });

  it('mezi nedokončivšími platí pořadí DSQ, DNF, DNS', () => {
    const ranked = rankEntriesByTime([
      entry({ id: 1, status: 'DNS' }),
      entry({ id: 2, status: 'DNF' }),
      entry({ id: 3, status: 'DSQ' })
    ]);

    expect(ranked.map((e) => e.status)).toEqual(['DSQ', 'DNF', 'DNS']);
  });

  it('při shodě času rozhoduje startovní číslo, pak id', () => {
    const ranked = rankEntriesByTime([
      entry({ id: 9, start_number: 5, time_sum: 60 }),
      entry({ id: 2, start_number: 3, time_sum: 60 })
    ]);

    expect(ranked.map((e) => e.id)).toEqual([2, 9]);
  });
});

describe('rankEntriesByTime - shodný čas', () => {
  it('stejný čas dostane stejné pořadí i stejné body', () => {
    const ranked = rankEntriesByTime([
      entry({ id: 1, start_number: 1, time_sum: 60 }),
      entry({ id: 2, start_number: 2, time_sum: 60 }),
      entry({ id: 3, start_number: 3, time_sum: 61 })
    ]);

    expect(ranked.map((e) => e.display_rank)).toEqual([1, 1, 3]);
    expect(ranked[0].display_points).toBe(ranked[1].display_points);
    // Třetí v cíli je na 3. místě, druhé se přeskakuje.
    expect(ranked[2].display_rank).toBe(3);
  });
});

describe('rankEntriesByTime - body a ztráta', () => {
  it('body odpovídají pořadí, nedokončivší mají nulu', () => {
    const ranked = rankEntriesByTime([
      entry({ id: 1, time_sum: 60 }),
      entry({ id: 2, start_number: 2, time_sum: 61 }),
      entry({ id: 3, start_number: 3, status: 'DNF' })
    ]);

    expect(ranked.map((e) => e.display_points)).toEqual([100, 80, 0]);
  });

  it('ztráta se počítá na vítěze a u vítěze je prázdná', () => {
    const ranked = rankEntriesByTime([
      entry({ id: 1, time_sum: 60 }),
      entry({ id: 2, start_number: 2, time_sum: 62.5 })
    ]);

    expect(ranked[0].display_diff).toBeNull();
    expect(ranked[1].display_diff).toBeCloseTo(2.5);
  });

  it('prázdná kategorie nic neshodí', () => {
    expect(rankEntriesByTime([])).toEqual([]);
  });
});

describe('rankEntriesByTime - pořadí jednoho kola', () => {
  it('podle 1. kola se řadí jinak než podle součtu', () => {
    const ranked = rankEntriesByTime([
      entry({ id: 1, start_number: 1, time1: 62, time2: 58, time_sum: 120 }),
      entry({ id: 2, start_number: 2, time1: 60, time2: 65, time_sum: 125 })
    ], { timeField: 'time1' });

    expect(ranked.map((e) => e.id)).toEqual([2, 1]);
    expect(ranked[0].display_points).toBe(100);
    expect(ranked[1].display_diff).toBeCloseTo(2);
  });

  it('kdo druhé kolo nejel, je v jeho listině bez pořadí', () => {
    const ranked = rankEntriesByTime([
      entry({ id: 1, start_number: 1, time1: 60, time2: null, time_sum: 60 }),
      entry({ id: 2, start_number: 2, time1: 61, time2: 59, time_sum: 120 })
    ], { timeField: 'time2' });

    expect(ranked.map((e) => e.id)).toEqual([2, 1]);
    expect(ranked[0].display_rank).toBe(1);
    expect(ranked[1].display_rank).toBeNull();
  });
});

describe('resultStatus', () => {
  it('startovní listina má příznaky, výsledky hotový stav', () => {
    expect(resultStatus({ dnf: true })).toBe('DNF');
    expect(resultStatus({ dns: true })).toBe('DNS');
    expect(resultStatus({ dsq: true })).toBe('DSQ');
    expect(resultStatus({ dnf: false, dns: false, dsq: false })).toBeNull();
    expect(resultStatus({ status: 'DSQ' })).toBe('DSQ');
    expect(resultStatus({ status: null, dnf: true })).toBeNull();
  });

  it('řádek startovky se dá seřadit bez převodu na výsledek', () => {
    const ranked = rankEntriesByTime([
      { id: 1, start_number: 1, time_sum: 60, dnf: true, dns: false, dsq: false },
      { id: 2, start_number: 2, time_sum: 61, dnf: false, dns: false, dsq: false }
    ]);

    expect(ranked.map((e) => e.id)).toEqual([2, 1]);
    expect(ranked[0].display_rank).toBe(1);
    expect(ranked[1].status).toBe('DNF');
    expect(ranked[1].display_rank).toBeNull();
  });
});

describe('formatResultTime', () => {
  it('čas má vždy dvě desetinná místa', () => {
    expect(formatResultTime(60)).toBe('60.00');
    expect(formatResultTime(60.456)).toBe('60.46');
  });

  it('nenaměřený čas je pomlčka', () => {
    expect(formatResultTime(null)).toBe('—');
  });
});

describe('ResultsTable', () => {
  it('vykreslí závodníky v pořadí podle času', () => {
    render(<ResultsTable entries={[
      entry({ id: 1, start_number: 1, time_sum: 62, racer_surname: 'Druhý' }),
      entry({ id: 2, start_number: 2, time_sum: 60, racer_surname: 'První' })
    ]} />);

    const rows = screen.getAllByRole('row').slice(1); // bez hlavičky
    expect(rows[0]).toHaveTextContent('První');
    expect(rows[1]).toHaveTextContent('Druhý');
  });

  it('sloupec s body je jen tam, kde se o něj řekne', () => {
    const entries = [entry({ time_sum: 60 })];

    const { unmount } = render(<ResultsTable entries={entries} />);
    expect(screen.queryByText('Body')).not.toBeInTheDocument();
    unmount();

    render(<ResultsTable entries={entries} showPoints />);
    expect(screen.getByText('Body')).toBeInTheDocument();
  });
});
