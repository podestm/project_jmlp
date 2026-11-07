import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../config/api.js', () => ({ AdminAPI: { get: (...args) => mockGet(...args) } }));
vi.mock('react-chartjs-2', () => ({ Line: () => <div data-testid="graf" /> }));

const { default: AdminDashboard } = await import('./AdminDashboard.jsx');

const STATS = {
  season: { id: 2026, label: '2026/2027' },
  counts: {
    total_racers: 1284,
    total_clubs: 31,
    total_posts: 12,
    season_races: 3,
    open_registrations: 1,
    pending_club_requests: 3,
    storage_size: '84.9 MB',
    file_count: 96,
  },
  visits: { today: 248, today_unique: 166, last_7_days: 1940 },
  upcoming_race: {
    id: 132,
    race_nr: 'JMLP2026-03',
    datum: '2026-10-18',
    areal_name: 'Sportovní Areál VUT Brno',
    registration: true,
    registration_count: 58,
    days_until: 7,
  },
  recent_registrations: [
    {
      registered_at: '2026-10-11T18:47:00',
      racer_name: 'Adam',
      racer_surname: 'Kratochvíl',
      race_nr: 'JMLP2026-03',
      areal_name: 'VUT',
      club_name: 'SKI KLUB JUNIOR BRNO',
    },
  ],
  top_pages: [{ path: '/zavody', visits: 408 }],
  recent_posts: [
    { id: 1, title: 'Jubilejní XX. sezóna', published: false, created_at: '2026-09-16T10:00:00' },
  ],
};

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>,
  );

describe('přehled administrace', () => {
  beforeEach(() => {
    mockGet.mockReset().mockImplementation((url) =>
      url.startsWith('/api/admin/dashboard/visits-chart')
        ? Promise.resolve([
            { date: '10.10', visits: 200, unique: 120 },
            { date: '11.10', visits: 248, unique: 166 },
          ])
        : Promise.resolve(STATS),
    );
  });

  it('ukáže žádosti o kluby, čísla, nejbližší závod a poslední přihlášky', async () => {
    renderDashboard();
    expect(
      await screen.findByRole('link', { name: /3 nevyřízené žádosti o přiřazení klubu/ }),
    ).toHaveAttribute('href', '/admin/club-requests');
    expect(screen.getByText('Závodníků v databázi').parentElement).toHaveTextContent(/1\s284/);
    expect(screen.getByRole('link', { name: '58 přihlášených závodníků' })).toHaveAttribute(
      'href',
      '/admin/races/132/registrations',
    );
    expect(screen.getByRole('table', { name: 'Poslední přihlášky' })).toHaveTextContent(
      'Kratochvíl Adam',
    );
    expect(screen.getByText('Koncept')).toBeInTheDocument();
    expect(await screen.findByText(/448 návštěv za 7 dní/)).toBeInTheDocument();
  });

  it('chyba načtení nemá křížek, nechá prázdné dlaždice a jde zkusit znovu', async () => {
    mockGet.mockRejectedValueOnce(new Error('503 Service Unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderDashboard();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Přehled se teď nepodařilo načíst');
    expect(within(alert).queryByRole('button', { name: 'Zavřít hlášku' })).toBeNull();
    expect(screen.getAllByLabelText('nenačteno')).toHaveLength(4);

    await userEvent.click(within(alert).getByRole('button', { name: 'Zkusit načíst znovu' }));
    expect(await screen.findByText('Závodníků v databázi')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
