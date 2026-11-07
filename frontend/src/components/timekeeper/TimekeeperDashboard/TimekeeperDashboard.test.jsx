import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = { get: vi.fn(), put: vi.fn() };
vi.mock('../../../config/timekeeperApi.js', () => ({ TimekeeperAPI: api }));

const { default: TimekeeperDashboard } = await import('./TimekeeperDashboard.jsx');
const { SELECTED_RACE_KEY } = await import('../frame/selectedRace.js');

const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const RACES = [
  {
    id: 2,
    race_nr: 'JMLP2026-02',
    areal_name: 'Kraví hora',
    datum: iso(7),
    registration: false,
    is_live: false,
    reg_count: 0,
    start_list_count: 0,
  },
  {
    id: 1,
    race_nr: 'JMLP2026-01',
    areal_name: 'Kohoutovice',
    datum: iso(0),
    registration: false,
    is_live: true,
    reg_count: 58,
    start_list_count: 57,
  },
  {
    id: 9,
    race_nr: 'JMLP2025-05',
    areal_name: 'Fajťák',
    datum: iso(-200),
    registration: false,
    is_live: false,
    reg_count: 40,
    start_list_count: 40,
  },
];

const renderScreen = () =>
  render(
    <MemoryRouter initialEntries={['/timekeeper']}>
      <Routes>
        <Route path="/timekeeper" element={<TimekeeperDashboard />} />
        <Route path="/timekeeper/start-list" element={<p>startovka</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  api.get.mockReset().mockResolvedValue(RACES);
  api.put.mockReset().mockResolvedValue({});
});

describe('výběr závodu', () => {
  it('nadcházející od nejbližšího a proběhlé zvlášť', async () => {
    renderScreen();
    const upcoming = (await screen.findByRole('heading', { name: 'Nadcházející závody' })).closest(
      'section',
    );
    const titles = within(upcoming)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(titles).toEqual(['Kohoutovice', 'Kraví hora']);
    expect(within(upcoming).getByText('Dnes se měří')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Proběhlé závody' })).toBeInTheDocument();
  });

  it('výběr závodu si notebook zapamatuje a otevře startovku', async () => {
    renderScreen();
    const card = await screen.findByRole('article', { name: 'Kraví hora' });
    await userEvent.click(within(card).getByRole('button', { name: /Přepnout na tento závod/ }));
    expect(localStorage.getItem(SELECTED_RACE_KEY)).toBe('2');
    expect(await screen.findByText('startovka')).toBeInTheDocument();
  });

  it('naposledy vybraný závod nahoře', async () => {
    localStorage.setItem(SELECTED_RACE_KEY, '1');
    renderScreen();
    const last = await screen.findByRole('region', { name: 'Naposledy vybraný závod' });
    expect(last).toHaveTextContent('Kohoutovice');
    expect(
      within(screen.getByRole('article', { name: 'Kohoutovice' })).getByText('Vybráno'),
    ).toBeInTheDocument();
  });

  it('živý přenos jde přepnout', async () => {
    renderScreen();
    const card = await screen.findByRole('article', { name: 'Kohoutovice' });
    const live = within(card).getByRole('button', { name: /Přenos ŽIVĚ běží/ });
    expect(live).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(live);
    expect(api.put).toHaveBeenCalledWith('/api/timekeeper/races/1/live', {});
  });

  it('chyba načtení a prázdná sezóna', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderScreen();
    expect(await screen.findByRole('alert')).toHaveTextContent('Nepodařilo se načíst závody');
    expect(screen.queryByText('Žádné závody v aktuální sezóně')).toBeNull();
  });

  it('závody starší než předchozí sezóna jsou až za tlačítkem', async () => {
    api.get.mockResolvedValue([
      ...RACES,
      {
        id: 7,
        race_nr: 'JMLP2019-02',
        areal_name: 'Sedmihorky',
        datum: '2020-01-20',
        registration: false,
        is_live: false,
      },
    ]);
    renderScreen();
    await screen.findByRole('heading', { name: 'Proběhlé závody' });
    expect(screen.queryByText('Sedmihorky')).toBeNull();
    expect(screen.getByText('Fajťák')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zobrazit starší závody (1)' }));
    expect(screen.getByText('Sedmihorky')).toBeInTheDocument();
  });
});
