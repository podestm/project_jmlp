import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RaceDetail from './RaceDetail.jsx';

const RACE = {
  id: 7,
  race_nr: 'JMLP2026-01',
  datum: '2026-10-03',
  registration: true,
  closed: false,
  race_method_id: 2,
  areal_name: 'Brno - Kohoutovice',
  organizer_name: 'FreeSki Academy Brno',
  proposition_file_id: 5,
  results_file_id: null,
  season_id: 2026,
};
const REGISTRATIONS = {
  total_racers: 1,
  clubs: [
    {
      club_name: 'SKI KLUB JUNIOR BRNO',
      racers: [
        {
          firstName: 'Matyáš',
          lastName: 'Novák',
          birthYear: 2013,
          idSlcr: '204118',
          category_name: 'Starší žáci',
        },
      ],
    },
  ],
};

const json = (body, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body });

const mockApi = (race, { registrations = REGISTRATIONS, upcoming = [] } = {}) => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const path = String(url);
      if (path.startsWith('/races/?upcoming')) return json(upcoming);
      if (path.endsWith('/registrations')) return json(registrations);
      if (path.startsWith('/races/'))
        return race ? json(race) : json({ detail: 'Race not found' }, 404);
      if (path.startsWith('/clubs/')) return json([{ id: 1, name: 'SKI KLUB JUNIOR BRNO' }]);
      return json([]);
    }),
  );
};

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={['/zavod/7']}>
      <Routes>
        <Route path="/zavod/:raceId" element={<RaceDetail />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-23T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RaceDetail', () => {
  it('otevřená registrace: formulář a přihlášení podle klubů', async () => {
    mockApi(RACE);
    renderDetail();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Brno - Kohoutovice' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Přihlášky otevřeny')).toBeInTheDocument();
    const list = await screen.findByRole('region', { name: /Přihlášení závodníci/ });
    expect(await within(list).findByText('Novák Matyáš')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Přihlásit závodníka' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ochrany osobních údajů' })).toHaveAttribute(
      'href',
      '/ochrana-osobnich-udaju',
    );
    expect(document.title).toBe('Brno - Kohoutovice, 3. 10. 2026 · JMLP');
    expect(document.querySelector('meta[name="description"]').content).toBe(
      'Závod Jihomoravského lyžařského poháru v areálu Brno - Kohoutovice dne 3. 10. 2026, pořádá FreeSki Academy Brno. Propozice, přihlášky a výsledky.',
    );
  });

  it('pohlaví není předvyplněné a chyby jsou u polí', async () => {
    mockApi(RACE);
    renderDetail();

    await screen.findByRole('button', { name: 'Přihlásit závodníka' });
    expect(screen.getByRole('radio', { name: 'Muž' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Žena' })).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Přihlásit závodníka' }));
    expect(screen.getByText('Jméno je povinné')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Pohlaví/ })).toHaveAccessibleDescription(
      'Vyberte pohlaví',
    );
  });

  it('uzavřená registrace bez přihlášených nabídne, co dělat dál', async () => {
    mockApi(
      { ...RACE, registration: false },
      {
        registrations: { total_racers: 0, clubs: [] },
        upcoming: [{ ...RACE, id: 8, areal_name: 'Kraví hora', datum: '2026-10-10' }],
      },
    );
    renderDetail();

    expect(await screen.findByText('Na tento závod se teď přihlásit nedá')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Přihlásit' })).toHaveAttribute(
      'href',
      '/zavod/8#prihlaska',
    );
    expect(await screen.findByText('Seznam se ukáže s otevřením přihlášek')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Přihlásit závodníka' })).not.toBeInTheDocument();
  });

  it('odjetý závod: výsledky, seznam přihlášených se nenačítá', async () => {
    mockApi({ ...RACE, datum: '2026-09-01', registration: false, results_file_id: 9 });
    renderDetail();

    expect(await screen.findByText('Oficiální výsledková listina')).toBeInTheDocument();
    expect(screen.getByText('Přihlašování skončilo před závodem')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith('/races/7/registrations');
  });

  it('odjetý závod se znovu otevřenou registrací nabízí přihlášku', async () => {
    mockApi({ ...RACE, datum: '2026-09-01', results_file_id: 9 });
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Přihlásit závodníka' })).toBeInTheDocument();
    expect(screen.queryByText('Oficiální výsledková listina')).not.toBeInTheDocument();
  });

  it('neexistující závod a výpadek serveru jsou rozlišené', async () => {
    mockApi(null);
    renderDetail();
    expect(await screen.findByText('Tenhle závod v kalendáři nenajdeme')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zpět na kalendář závodů' })).toHaveAttribute(
      'href',
      '/zavody',
    );
  });

  it('chyba serveru nabídne zkusit znovu', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json({}, 500)),
    );
    renderDetail();
    expect(await screen.findByText('Závod se nepodařilo načíst')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });
});
