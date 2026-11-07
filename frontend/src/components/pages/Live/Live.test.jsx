import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Live from './Live.jsx';

const entry = (id, surname, time1, time2, extra = {}) => ({
  id, start_number: id, race_number_actual: id, set_color: 'blue', racer_name: 'Eliška', racer_surname: surname, racer_year: 2016,
  club_name: 'SKI KLUB JUNIOR BRNO', time1, time2, time_sum: time1 != null && time2 != null ? time1 + time2 : null, ...extra,
});

const LIVE = {
  race_id: 133, race_nr: 'JMLP2026-02', race_date: '2026-10-10', areal_name: 'Brno - Kraví hora', race_method_id: 2,
  categories: [
    { category_id: 19, category_name: 'Juniorky', entries: [entry(1, 'Stará', 30, 31)] },
    { category_id: 3, category_name: 'Předžačky', entries: [entry(30, 'Nováková', 33.12, 32.8), entry(32, 'Dvořáková', 33.48, 33.05), entry(7, 'Pokorná', 37.02, null, { status: 'DNF' })] },
  ],
};

const json = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });
const renderLive = () => render(<MemoryRouter><Live /></MemoryRouter>);

afterEach(() => vi.unstubAllGlobals());

describe('Live', () => {
  it('běžící závod: neoficiální výsledky, první zobrazená kategorie, pořadí a ztráta', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json(LIVE)));
    renderLive();

    expect(await screen.findByRole('heading', { level: 1, name: 'Brno - Kraví hora' })).toBeInTheDocument();
    expect(screen.getByText('Neoficiální výsledky.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Předžačky (3)', pressed: true })).toBeInTheDocument();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Nováková');
    expect(rows[2]).toHaveTextContent('+0.61');
    expect(rows[3]).toHaveTextContent('DNF');

    await userEvent.click(screen.getByRole('button', { name: 'Juniorky (1)' }));
    expect(screen.getByRole('table')).toHaveTextContent('Stará');
  });

  it('když se nezávodí, ukáže klidový stav místo přesměrování', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => (String(url) === '/races/live' ? json({ detail: 'x' }, 404) : json([]))));
    renderLive();
    expect(await screen.findByRole('heading', { level: 1, name: 'Právě se nezávodí' })).toBeInTheDocument();
  });

  it('bez spojení hned na začátku nabídne zkusit znovu', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    renderLive();
    expect(await screen.findByText('Živé výsledky se nepodařilo načíst')).toBeInTheDocument();
  });
});
