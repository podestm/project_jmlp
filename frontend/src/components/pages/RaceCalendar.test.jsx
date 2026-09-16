import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RaceCalendar from './RaceCalendar.jsx';

/**
 * Tlačítko výsledků sezóny v kalendáři.
 *
 * Vzniklo po chybě z ostrého webu: sezóna 2026/27 ještě žádné výsledky neměla,
 * přesto kalendář nabízel "Průběžné výsledky" a pod nimi se stáhl soutěžní řád.
 * Backend už vrací jen skutečné výsledky (routers/season_results.py); sezóna
 * bez nich má tlačítko vypnuté.
 */
const zavod = (id, raceNr, datum) => ({
  id,
  race_nr: raceNr,
  datum,
  areal_name: 'Olešnice',
  organizer_name: 'SK Olešnice',
  race_method_id: 1,
  registration: false
});

const ZAVODY = [
  zavod(132, 'JMLP2026-01', '2026-10-03'),
  zavod(120, 'JMLP2025-01', '2026-01-10'),
  zavod(110, 'JMLP2024-01', '2025-01-11')
];

const VYSLEDKY = [{
  season_year_start: 2025,
  season_year_end: 2026,
  final_results: 1,
  document_file_path: 'uploads/documents/vysledky-2025.pdf'
}];

const jsonResponse = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  // Jen Date - časovače zůstávají skutečné, jinak by se nedočkalo findBy*
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-15T12:00:00'));
  vi.stubGlobal('fetch', vi.fn((url) => {
    const cesta = String(url);
    if (cesta.startsWith('/season-results/')) return jsonResponse(VYSLEDKY);
    if (cesta.startsWith('/races/')) return jsonResponse(ZAVODY);
    return jsonResponse([]);
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

const renderCalendar = () => render(<MemoryRouter><RaceCalendar /></MemoryRouter>);

describe('RaceCalendar - výsledky sezóny', () => {
  it('aktuální sezóna bez výsledků má průběžné výsledky vypnuté', async () => {
    renderCalendar();

    const tlacitko = await screen.findByRole('button', { name: /Průběžné výsledky/ });

    expect(tlacitko).toBeDisabled();
    expect(screen.queryByRole('link', { name: /výsledky/i })).not.toBeInTheDocument();
  });

  it('zveřejněné výsledky jsou odkaz ke stažení', async () => {
    renderCalendar();
    await userEvent.click(await screen.findByRole('button', { name: '2025/26' }));

    const odkaz = screen.getByRole('link', { name: /Celkové výsledky/ });

    expect(odkaz).toHaveAttribute('href', '/uploads/documents/vysledky-2025.pdf');
  });

  it('skončená sezóna bez výsledků má vypnuté celkové výsledky', async () => {
    renderCalendar();
    await userEvent.click(await screen.findByRole('button', { name: '2024/25' }));

    expect(screen.getByRole('button', { name: /Celkové výsledky/ })).toBeDisabled();
  });
});
