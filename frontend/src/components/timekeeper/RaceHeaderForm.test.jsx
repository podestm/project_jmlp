import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TimekeeperAuthProvider } from '../../config/timekeeperAuth.jsx';
import RaceHeaderForm from './RaceHeaderForm.jsx';
import { resetTimekeeperDb, setOnline } from '../../test/helpers.js';

const DETAIL = {
  race_director: 'Markéta', technical_delegate: null, chief_timekeeper: null,
  race_number_label: '3. závod', edition_label: null, runs: [],
};

const ok = (body) => ({ ok: true, status: 200, statusText: 'OK', json: async () => body });

const renderForm = () => render(
  <MemoryRouter>
    <TimekeeperAuthProvider>
      <RaceHeaderForm />
    </TimekeeperAuthProvider>
  </MemoryRouter>
);

beforeEach(async () => {
  await resetTimekeeperDb();
  localStorage.setItem('auth_token', 'token-pro-test');
  localStorage.setItem('timekeeper_selected_race', '7');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  setOnline(true);
  localStorage.removeItem('timekeeper_selected_race');
  vi.unstubAllGlobals();
});

describe('Údaje závodu bez signálu', () => {
  it('bez dat v zařízení vysvětlí proč a po "Zkusit znovu" se načte', async () => {
    setOnline(false);
    const fetchMock = vi.fn(async (url) => ok(String(url).includes('/detail') ? DETAIL : []));
    vi.stubGlobal('fetch', fetchMock);

    renderForm();

    expect(await screen.findByText('Údaje závodu nejsou v zařízení')).toBeInTheDocument();
    expect(screen.queryByText(/Načítám údaje závodu/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    setOnline(true);
    await userEvent.click(screen.getByRole('button', { name: /Zkusit znovu/ }));

    expect(await screen.findByDisplayValue('Markéta')).toBeInTheDocument();
    expect(screen.queryByText('Údaje závodu nejsou v zařízení')).not.toBeInTheDocument();
  });

  it('po návratu signálu se načte samo', async () => {
    setOnline(false);
    vi.stubGlobal('fetch', vi.fn(async (url) => ok(String(url).includes('/detail') ? DETAIL : [])));

    renderForm();
    await screen.findByText('Údaje závodu nejsou v zařízení');

    setOnline(true);
    window.dispatchEvent(new Event('online'));

    expect(await screen.findByDisplayValue('Markéta')).toBeInTheDocument();
  });
});
