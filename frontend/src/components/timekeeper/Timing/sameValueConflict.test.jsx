import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { TimekeeperAuthProvider } from '../../../config/timekeeperAuth.jsx';
import { resetTimekeeperDb, setOnline, startListEntry } from '../../../test/helpers.js';
import { SerialSessionProvider } from '../SerialSessionProvider.jsx';
import { SELECTED_RACE_KEY } from '../frame/selectedRace.js';
import TimingEntry from './TimingEntry.jsx';

/**
 * Konflikt se stejnou hodnotou (na produkci 219.6 proti 219.6): fronta čas
 * mezitím doručila, nebo přišel z impulzu i ručně. Server pod starším
 * razítkem vrátí 409, ale na řádku už je přesně to, co obsluha ukládá -
 * dialog „Záznam byl mezitím změněn“ by chtěl rozhodnutí, které nemá smysl.
 */

const RACE_ID = 10;
const START_LIST = `/api/timekeeper/races/${RACE_ID}/start-list`;

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: 'Test',
  json: async () => body,
});

let serverRow;
let fetchMock;

beforeEach(async () => {
  await resetTimekeeperDb();
  setOnline(true);
  localStorage.setItem('auth_token', 'token-pro-test');
  localStorage.setItem(SELECTED_RACE_KEY, String(RACE_ID));

  serverRow = startListEntry({
    id: 1,
    race_id: RACE_ID,
    category_id: 5,
    category_name: 'Myšáci dívky',
    category_rank: 0,
    start_number: 1,
    racer_surname: 'Bečvářová',
    racer_name: 'Sophia',
    race_number_actual: 1,
    club_name: 'Ski klub Victoria Brno',
    racer_year: 2020,
    excluded: false,
    time1: null,
    updated_at: '2026-10-10T09:00:00Z',
  });

  fetchMock = vi.fn(async (url, options = {}) => {
    const method = options.method || 'GET';
    const path = String(url).split('?')[0];
    if (method === 'GET' && path === START_LIST) return jsonResponse([serverRow]);
    if (method === 'PUT' && path === '/api/timekeeper/start-list/1/time') {
      // Mezitím se uložil tentýž čas pod novějším razítkem.
      serverRow = { ...serverRow, time1: 219.6, updated_at: '2026-10-10T09:05:00Z' };
      return jsonResponse({ detail: { code: 'stale_revision', entry_id: 1 } }, 409);
    }
    if (method === 'GET' && path === '/api/timekeeper/start-list/1') return jsonResponse(serverRow);
    return jsonResponse([]);
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Časy - konflikt se stejnou hodnotou', () => {
  it('neukáže dialog a čas zůstane uložený', async () => {
    render(
      <MemoryRouter>
        <TimekeeperAuthProvider>
          <SerialSessionProvider>
            <TimingEntry />
          </SerialSessionProvider>
        </TimekeeperAuthProvider>
      </MemoryRouter>,
    );

    const input = await screen.findByLabelText('Kolo 1 – Bečvářová Sophia');
    await userEvent.type(input, '219.6');
    await userEvent.tab();

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) => String(url).split('?')[0] === '/api/timekeeper/start-list/1',
        ),
      ).toBe(true),
    );
    expect(screen.queryByText('Záznam byl mezitím změněn')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Kolo 1 – Bečvářová Sophia')).toHaveValue(219.6);
  });
});
