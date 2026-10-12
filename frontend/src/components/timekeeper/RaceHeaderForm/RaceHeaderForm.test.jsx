import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = { get: vi.fn(), put: vi.fn() };
vi.mock('../../../config/timekeeperApi.js', () => ({ TimekeeperAPI: api }));

const { default: RaceHeaderForm } = await import('./RaceHeaderForm.jsx');
const { SELECTED_RACE_KEY } = await import('../frame/selectedRace.js');

const DETAIL = {
  race_number_label: '2026-01',
  areal_name: 'Brno – Kohoutovice',
  datum: '2026-10-03',
  organizer_name: 'FreeSki Academy Brno',
  organizer_logo_url: null,
  edition_label: 'XX.',
  race_director: 'Ing. Tomáš Malík',
  technical_delegate: null,
  chief_timekeeper: null,
  runs: [{ run_number: 1, course_setter: 'Martin Bureš', gates_count: 18, conditions: null, start_time: '9:00', course_length_m: 320 }],
};

const renderScreen = () => render(<MemoryRouter><RaceHeaderForm /></MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
  api.get.mockReset().mockResolvedValue(DETAIL);
  api.put.mockReset().mockResolvedValue(DETAIL);
});

describe('detail závodu', () => {
  it('bez vybraného závodu odkáže do Přehledu', () => {
    renderScreen();
    expect(screen.getByText('Vyberte závod')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Přehled závodů' })).toHaveAttribute('href', '/timekeeper');
  });

  it('vyplní formulář, ukáže co se doplní samo a uloží', async () => {
    localStorage.setItem(SELECTED_RACE_KEY, '7');
    renderScreen();

    expect(await screen.findByLabelText('Ředitel závodu')).toHaveValue('Ing. Tomáš Malík');
    expect(screen.getByLabelText('Stavitel trati', { selector: '#kolo-1-course_setter' })).toHaveValue('Martin Bureš');
    expect(screen.getByText('FreeSki Academy Brno')).toBeInTheDocument();
    expect(screen.getByText('Pořádající klub nemá nahrané logo')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Počet branek', { selector: '#kolo-2-gates_count' }), '20');
    await userEvent.click(screen.getByRole('button', { name: 'Uložit údaje závodu' }));

    expect(api.get).toHaveBeenCalledWith('/api/timekeeper/races/7/detail');
    const [url, payload] = api.put.mock.calls[0];
    expect(url).toBe('/api/timekeeper/races/7/detail');
    expect(payload.runs[1]).toMatchObject({ run_number: 2, gates_count: 20 });
    expect(await screen.findByText('Údaje závodu uloženy')).toBeInTheDocument();
  });

  it('bez signálu a bez uložené kopie řekne proč, místo věčného „Načítám“', async () => {
    localStorage.setItem(SELECTED_RACE_KEY, '7');
    api.get.mockRejectedValue(new Error('Offline režim: data nejsou dostupná v lokální cache.'));
    renderScreen();

    expect(await screen.findByText('Údaje závodu nejsou v zařízení')).toBeInTheDocument();
    expect(screen.queryByText('Načítám údaje závodu…')).not.toBeInTheDocument();

    api.get.mockResolvedValue(DETAIL);
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByLabelText('Ředitel závodu')).toHaveValue('Ing. Tomáš Malík');
  });
});
