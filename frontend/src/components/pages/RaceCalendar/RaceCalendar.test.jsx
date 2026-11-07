import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { resetCurrentSeason } from '../../../hooks/useCurrentSeason.js';
import RaceCalendar from './RaceCalendar.jsx';

/**
 * Tlačítko výsledků sezóny v kalendáři.
 *
 * Vzniklo po chybě z ostrého webu: sezóna 2026/27 ještě žádné výsledky neměla,
 * přesto kalendář nabízel "Průběžné výsledky" a pod nimi se stáhl soutěžní řád.
 * Backend už vrací jen skutečné výsledky (routers/season_results.py); sezóna
 * bez nich má tlačítko vypnuté. Sezóna se vybírá v <select>.
 */
const zavod = (id, raceNr, datum) => ({
  id,
  race_nr: raceNr,
  datum,
  areal_name: 'Olešnice',
  organizer_name: 'SK Olešnice',
  race_method_id: 1,
  registration: false,
});

const ZAVODY = [
  zavod(132, 'JMLP2026-01', '2026-10-03'),
  zavod(120, 'JMLP2025-01', '2026-01-10'),
  zavod(110, 'JMLP2024-01', '2025-01-11'),
];

const VYSLEDKY = [
  {
    season_year_start: 2025,
    season_year_end: 2026,
    final_results: 1,
    document_file_path: 'uploads/documents/vysledky-2025.pdf',
  },
];

const jsonResponse = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  // Jen Date - časovače zůstávají skutečné, jinak by se nedočkalo findBy*
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-15T12:00:00'));
  resetCurrentSeason();
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const cesta = String(url);
      if (cesta.startsWith('/season-results/')) return jsonResponse(VYSLEDKY);
      if (cesta.startsWith('/races/')) return jsonResponse(ZAVODY);
      return jsonResponse([]);
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

const renderCalendar = () =>
  render(
    <MemoryRouter>
      <RaceCalendar />
    </MemoryRouter>,
  );

describe('RaceCalendar - výsledky sezóny', () => {
  it('aktuální sezóna bez výsledků má průběžné výsledky vypnuté', async () => {
    renderCalendar();

    const tlacitko = await screen.findByRole('button', { name: /Průběžné výsledky/ });

    expect(tlacitko).toBeDisabled();
    expect(
      screen.queryByRole('link', { name: /(Celkové|Průběžné) výsledky/ }),
    ).not.toBeInTheDocument();
  });

  it('zveřejněné výsledky jsou odkaz ke stažení', async () => {
    renderCalendar();
    await userEvent.selectOptions(await screen.findByLabelText('Sezóna'), '2025');

    const odkaz = screen.getByRole('link', { name: /Celkové výsledky/ });

    expect(odkaz).toHaveAttribute('href', '/uploads/documents/vysledky-2025.pdf');
  });

  it('skončená sezóna bez výsledků má vypnuté celkové výsledky', async () => {
    renderCalendar();
    await userEvent.selectOptions(await screen.findByLabelText('Sezóna'), '2024');

    expect(screen.getByRole('button', { name: /Celkové výsledky/ })).toBeDisabled();
  });
});

describe('RaceCalendar - výchozí sezóna', () => {
  it('ukáže sezónu, kterou správce nastavil jako aktuální, ne sezónu podle data', async () => {
    fetch.mockImplementation((url) => {
      const cesta = String(url);
      if (cesta.startsWith('/races/season/current'))
        return jsonResponse({ current_season_id: 2025, edition: 19 });
      if (cesta.startsWith('/season-results/')) return jsonResponse(VYSLEDKY);
      return jsonResponse(ZAVODY);
    });
    renderCalendar();

    const vyber = await screen.findByLabelText('Sezóna');
    await waitFor(() => expect(vyber).toHaveValue('2025'));
    expect(screen.getByRole('link', { name: /Celkové výsledky/ })).toBeInTheDocument();
  });
});

describe('RaceCalendar - seznam', () => {
  it('rozdělí závody na nadcházející a odjeté a filtruje podle typu', async () => {
    fetch.mockImplementation((url) => {
      if (String(url).startsWith('/season-results/')) return jsonResponse([]);
      return jsonResponse([
        { ...zavod(1, 'JMLP2026-01', '2026-09-10'), areal_name: 'Kohoutovice', race_method_id: 2 },
        {
          ...zavod(2, 'JMLP2026-02', '2026-12-10'),
          areal_name: 'Olešnice',
          race_method_id: 1,
          registration: true,
        },
      ]);
    });
    renderCalendar();

    const upcoming = await screen.findByRole('region', { name: 'Nadcházející' });
    expect(upcoming).toHaveTextContent('Olešnice');
    expect(upcoming).toHaveTextContent('Registrace otevřena');
    expect(screen.getByRole('region', { name: 'Odjeté závody' })).toHaveTextContent('Kohoutovice');

    await userEvent.click(screen.getByRole('button', { name: /Na sněhu/ }));
    expect(screen.queryByText('Kohoutovice')).not.toBeInTheDocument();
  });

  it('chyba načtení nabídne zkusit znovu', async () => {
    fetch.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 500, json: async () => ({}) }),
    );
    renderCalendar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Kalendář se nepodařilo načíst');
    expect(screen.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });
});
