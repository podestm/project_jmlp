import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = { get: vi.fn(), put: vi.fn(), post: vi.fn() };
vi.mock('../../../config/timekeeperApi.js', () => ({ TimekeeperAPI: api }));

const { default: TimekeeperRacers } = await import('./TimekeeperRacers.jsx');
const { SELECTED_RACE_KEY } = await import('../frame/selectedRace.js');

const ROWS = [
  { id: 1, start_number: 1, racer_name: 'Tereza', racer_surname: 'Svobodová', racer_year: 2019, racer_sex: 2, club_name: 'SK Meteor Brno', category_id: 3, category_name: 'Přípravka dívky', race_number_display: 6, race_number_actual: 6, set_color: 'blue', excluded: false },
  { id: 2, start_number: 2, racer_name: 'Linda', racer_surname: 'Fialová', racer_year: 2015, racer_sex: 2, club_name: 'FreeSki Academy Brno', category_id: 7, category_name: 'Mladší žačky', race_number_display: 42, race_number_actual: 42, set_color: 'blue', excluded: true },
];

const GET = {
  '/api/timekeeper/races/7/start-list': ROWS,
  '/clubs/': [{ id: 1, name: 'SK Meteor Brno' }],
  '/api/timekeeper/race-number-options': [],
  '/api/timekeeper/categories': [],
};

const renderScreen = () => render(<MemoryRouter><TimekeeperRacers /></MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(SELECTED_RACE_KEY, '7');
  api.get.mockReset().mockImplementation(async (url) => GET[url] ?? []);
  api.put.mockReset();
  api.post.mockReset();
});

describe('závodníci závodu', () => {
  it('tabulka s dresem, vyřazený označený, nabídka klubů v datalistu', async () => {
    const { container } = renderScreen();
    const row = (await screen.findByText('Fialová Linda')).closest('tr');
    expect(row).toHaveAttribute('data-state', 'muted');
    expect(within(row).getByText('vyřazen')).toBeInTheDocument();
    expect(container.querySelector('datalist#clubs option')).toHaveAttribute('value', 'SK Meteor Brno');
  });

  it('nevyplněný formulář řekne, co chybí', async () => {
    renderScreen();
    await screen.findByText('Svobodová Tereza');
    await userEvent.click(screen.getByRole('button', { name: 'Přidat do závodu' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Vyplňte jméno, příjmení, rok narození, pohlaví a oddíl');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('oprava řádku uloží změny', async () => {
    api.put.mockResolvedValue({ entry: { ...ROWS[0], racer_name: 'Terezie' } });
    renderScreen();
    await userEvent.click(await screen.findByRole('button', { name: 'Upravit Svobodová Tereza' }));
    const name = screen.getByLabelText('Jméno', { selector: '#tk-edit-1-racer_name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Terezie');
    await userEvent.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(api.put).toHaveBeenCalledWith('/api/timekeeper/start-list/1', expect.objectContaining({ racer_name: 'Terezie', racer_sex: 2 }));
    expect(await screen.findByText('Svobodová Terezie')).toBeInTheDocument();
  });

  it('filtr bez výsledku jde zrušit', async () => {
    renderScreen();
    await screen.findByText('Svobodová Tereza');
    await userEvent.type(screen.getByLabelText('Hledat'), 'nikdo');
    expect(screen.getByText('Žádní závodníci neodpovídají aktuálním filtrům.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zrušit filtry' }));
    expect(screen.getByText('Svobodová Tereza')).toBeInTheDocument();
  });
});
