import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Results from './Results.jsx';

const RACES = [
  {
    id: 1,
    race_nr: 'JMLP2025-01',
    datum: '2025-10-04',
    race_method_id: 2,
    areal_name: 'Brno - Kohoutovice',
    results_file_id: 9,
    registration: false,
  },
  {
    id: 2,
    race_nr: 'JMLP2026-01',
    datum: '2026-10-03',
    race_method_id: 2,
    areal_name: 'Brno - Kohoutovice',
    results_file_id: null,
    registration: false,
  },
];

const STANDINGS_2025 = {
  season_id: 2025,
  season_label: '2025/26',
  edition_label: 'XIX.',
  final: true,
  document: { url: '/uploads/documents/poradi.pdf', final: true },
  races: [
    {
      id: 1,
      kind: 'P',
      datum: '2025-10-04',
      race_nr: 'JMLP2025-01',
      areal_name: 'Brno - Kohoutovice',
    },
  ],
  races_without_results: 0,
  categories: [
    {
      category_id: 3,
      name: 'Předžačky',
      rows: [
        {
          rank: 1,
          surname: 'Nováková',
          name: 'Eliška',
          year: 2016,
          club: 'SKI KLUB JUNIOR BRNO',
          cells: [{ rank: 1, points: 100, status: null, counted: true }],
          prep_points: 100,
          snow_points: 0,
          total: 100,
        },
      ],
    },
    {
      category_id: 4,
      name: 'Předžáci',
      rows: [
        {
          rank: null,
          surname: 'Novák',
          name: 'Jan',
          year: 2016,
          club: null,
          cells: [null],
          prep_points: 0,
          snow_points: 0,
          total: 0,
        },
      ],
    },
  ],
};
const EMPTY_2026 = {
  ...STANDINGS_2025,
  season_id: 2026,
  season_label: '2026/27',
  edition_label: 'XX.',
  final: false,
  document: null,
  races: [],
  categories: [],
};

const json = (body, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 500, json: async () => body });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-23T12:00:00'));
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const path = String(url);
      if (path === '/season-results/2025/standings') return json(STANDINGS_2025);
      if (path === '/season-results/2026/standings') return json(EMPTY_2026);
      if (path.startsWith('/season-results/')) return json([]);
      return json(RACES);
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const renderResults = () =>
  render(
    <MemoryRouter>
      <Results />
    </MemoryRouter>,
  );

describe('Results', () => {
  it('sezóna bez výsledků má poctivý prázdný stav a cestu na minulou sezónu', async () => {
    renderResults();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Výsledky a pořadí' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('V sezóně 2026/27 zatím pořadí není')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Pořadí sezóny 2025/26' }));

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Nováková Eliška')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Celkové výsledky (PDF)' })).toHaveAttribute(
      'href',
      '/uploads/documents/poradi.pdf',
    );
    expect(screen.getByRole('link', { name: 'Oficiální PDF' })).toHaveAttribute(
      'href',
      '/races/1/results',
    );
  });

  it('přepnutí kategorie', async () => {
    renderResults();
    await userEvent.selectOptions(await screen.findByLabelText('Sezóna'), '2025');
    await userEvent.click(await screen.findByRole('button', { name: 'Předžáci' }));
    expect(within(screen.getByRole('table')).getByText('Novák Jan')).toBeInTheDocument();
  });

  it('chyba načtení pořadí', async () => {
    fetch.mockImplementation((url) =>
      String(url).includes('/standings') ? json({}, false) : json(RACES),
    );
    renderResults();
    expect(await screen.findByText('Pořadí se nepodařilo načíst')).toBeInTheDocument();
  });
});
