import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { TimekeeperAuthProvider } from '../../config/timekeeperAuth.jsx';
import { appendInboxEvent } from '../../offline/bridgeInbox.js';
import { timekeeperDb } from '../../offline/db.js';
import { readCachedResponse } from '../../offline/startListCache.js';
import { resetTimekeeperDb, setOnline, startListEntry } from '../../test/helpers.js';
import { SerialSessionProvider } from './SerialSessionProvider.jsx';
import StartListManager from './StartListManager.jsx';
import { SELECTED_RACE_KEY } from './frame/selectedRace.js';
import TimingEntry from './TimingEntry.jsx';

/**
 * Vyřazení ze startky na obrazovkách časoměřiče.
 *
 * Závodník, který nedorazil, se nemaže: v Listině zůstává (jen tam se dá
 * vrátit), ze zadávání časů a z inboxu časomíry ale zmizí. Testuje se přes
 * fetch, jak to uvidí tablet na závodišti - ne přes vnitřní funkce.
 */

const RACE_ID = 10;
const START_LIST = `/api/timekeeper/races/${RACE_ID}/start-list`;

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: 'Test',
  json: async () => body
});

const row = (overrides) => startListEntry({
  race_id: RACE_ID,
  category_id: 5,
  category_name: 'Přípravka dívky',
  category_rank: 0,
  club_name: 'SK Pardubice',
  racer_year: 2017,
  excluded: false,
  ...overrides
});

let serverRows;
let fetchMock;

const putCalls = () => fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT');

beforeEach(async () => {
  await resetTimekeeperDb();
  setOnline(true);
  localStorage.setItem('auth_token', 'token-pro-test');
  localStorage.setItem(SELECTED_RACE_KEY, String(RACE_ID));

  serverRows = [
    row({ id: 1, start_number: 1, racer_surname: 'Nováková', racer_name: 'Anna', race_number_actual: 11 }),
    row({ id: 2, start_number: 2, racer_surname: 'Dvořáková', racer_name: 'Bára', race_number_actual: 12 })
  ];

  // Malý falešný server: drží startovku a vyřazení na ní opravdu zapíše.
  fetchMock = vi.fn(async (url, options = {}) => {
    const method = options.method || 'GET';
    const path = String(url).split('?')[0];

    if (method === 'GET' && path === START_LIST) return jsonResponse(serverRows);

    const excluded = path.match(/^\/api\/timekeeper\/start-list\/(\d+)\/excluded$/);
    if (method === 'PUT' && excluded) {
      const id = Number(excluded[1]);
      const body = JSON.parse(options.body);
      serverRows = serverRows.map((item) => (item.id === id ? { ...item, excluded: body.excluded } : item));
      return jsonResponse({
        message: 'ok',
        entry: serverRows.find((item) => item.id === id),
        idempotency_replayed: false
      });
    }

    return jsonResponse([]);
  });
  vi.stubGlobal('fetch', fetchMock);
  // Web Serial v jsdom není; obrazovka si s tím poradí, jen to zaloguje.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const renderListina = () => render(
  <MemoryRouter>
    <StartListManager />
  </MemoryRouter>
);

const renderCasy = () => render(
  <MemoryRouter>
    <TimekeeperAuthProvider>
      <SerialSessionProvider>
        <TimingEntry />
      </SerialSessionProvider>
    </TimekeeperAuthProvider>
  </MemoryRouter>
);

const rowOf = async (name) => (await screen.findByText(name)).closest('tr');

/** Řádek po doběhnutí zápisu - klik vrátí dřív, než se odpověď promítne. */
const rowOnceMarked = async (name, excluded) => {
  await waitFor(() => {
    const tr = screen.getByText(name).closest('tr');
    if (excluded) expect(tr).toHaveClass('tk-row-excluded');
    else expect(tr).not.toHaveClass('tk-row-excluded');
  });
  return screen.getByText(name).closest('tr');
};

describe('Listina - Vyřadit / Vrátit', () => {
  it('vyřadí závodníka: řádek zůstane, označený, a nepočítá se', async () => {
    renderListina();
    const dvorakova = await rowOf('Dvořáková Bára');

    await userEvent.click(within(dvorakova).getByRole('button', { name: 'Vyřadit' }));

    expect(putCalls()).toHaveLength(1);
    const [url, options] = putCalls()[0];
    expect(url).toBe('/api/timekeeper/start-list/2/excluded');
    expect(JSON.parse(options.body)).toEqual({ excluded: true });
    // Klíč idempotence nese každý zápis - přehrávka se na serveru neprovede dvakrát.
    expect(options.headers['X-Idempotency-Key']).toBeTruthy();

    const marked = await rowOnceMarked('Dvořáková Bára', true);
    expect(within(marked).getByText('vyřazen')).toBeInTheDocument();
    expect(within(marked).getByRole('button', { name: 'Vrátit' })).toBeInTheDocument();

    // Na startovce zůstala jedna, vyřazená se hlásí zvlášť.
    expect(screen.getByText('Závodníků:').textContent).toBe('Závodníků: 1(vyřazeno: 1)');
    expect(screen.getByText('(vyřazeno: 1)')).toBeInTheDocument();
    expect(screen.getByText('vyřazeno: 1')).toBeInTheDocument();
  });

  it('Vrátit ho obnoví', async () => {
    serverRows[1] = { ...serverRows[1], excluded: true, time1: 31.5, time_sum: 31.5 };
    renderListina();
    const dvorakova = await rowOf('Dvořáková Bára');
    expect(dvorakova).toHaveClass('tk-row-excluded');

    await userEvent.click(within(dvorakova).getByRole('button', { name: 'Vrátit' }));

    expect(JSON.parse(putCalls()[0][1].body)).toEqual({ excluded: false });
    const restored = await rowOnceMarked('Dvořáková Bára', false);
    // Čas naměřený před vyřazením je pořád tam.
    expect(within(restored).getAllByText('31.50').length).toBeGreaterThan(0);
    expect(within(restored).getByRole('button', { name: 'Vyřadit' })).toBeInTheDocument();
    expect(screen.queryByText('(vyřazeno: 1)')).not.toBeInTheDocument();
  });

  it('bez signálu se vyřazení uloží do fronty a platí hned i v zařízení', async () => {
    renderListina();
    const dvorakova = await rowOf('Dvořáková Bára');
    setOnline(false);

    await userEvent.click(within(dvorakova).getByRole('button', { name: 'Vyřadit' }));

    expect(putCalls()).toHaveLength(0);
    expect(await screen.findByText(/čeká na synchronizaci/)).toBeInTheDocument();
    await rowOnceMarked('Dvořáková Bára', true);

    const queued = await timekeeperDb.syncQueue.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      method: 'PUT',
      endpoint: '/api/timekeeper/start-list/2/excluded',
      payload: { excluded: true }
    });
    // Obrazovka Časy čte offline z IndexedDB - musí vyřazení vidět taky.
    expect((await timekeeperDb.startList.get(2)).excluded).toBe(true);
    // TimekeeperAPI.get ukládá pod klíčem i s prázdnými parametry.
    const cached = await readCachedResponse(START_LIST, {});
    expect(cached.find((item) => item.id === 2).excluded).toBe(true);
  });
});

describe('Časy - vyřazený se nezobrazuje', () => {
  it('v tabulce zadávání časů vyřazený chybí a obrazovka řekne proč', async () => {
    serverRows[1] = { ...serverRows[1], excluded: true };
    renderCasy();

    expect(await screen.findByText('Nováková Anna')).toBeInTheDocument();
    expect(screen.queryByText('Dvořáková Bára')).not.toBeInTheDocument();
    expect(screen.getByText(/Vyřazení ze startovní listiny \(1\) se tu nezobrazují/)).toBeInTheDocument();
  });

  it('impulz s dresem vyřazeného nikomu nepřiřadí a vysvětlí to', async () => {
    serverRows[1] = { ...serverRows[1], excluded: true };
    await appendInboxEvent({ type: 'TIME', bib: 12, time: '00:31.20', raw: '1 12 00:31.20' });
    renderCasy();

    expect(await screen.findByText(/vyřazený ze startky – vraťte ho v Listině/)).toBeInTheDocument();
    expect(screen.getByTitle('Přiřadit a uložit')).toBeDisabled();
  });
});
