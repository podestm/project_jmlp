import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), deleteOnline: vi.fn() };
vi.mock('../../../config/timekeeperApi.js', () => ({ TimekeeperAPI: api }));
vi.mock('../../../offline/useSyncStatus.js', () => ({
  useSyncStatus: () => ({ isOnline: true, queueStats: { total: 0 } }),
}));

const { default: StartListManager } = await import('./StartListManager.jsx');
const { SELECTED_RACE_KEY } = await import('../frame/selectedRace.js');

const CATEGORIES = [
  { id: 1, name: 'Myšáci dívky', sex: 2 },
  { id: 2, name: 'Myšáci chlapci', sex: 1 },
];

let rows;
const renderScreen = () =>
  render(
    <MemoryRouter>
      <StartListManager />
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(SELECTED_RACE_KEY, '7');
  rows = [];
  api.get.mockReset().mockImplementation(async (url) => {
    if (url === '/api/timekeeper/races/7/start-list') return rows;
    if (url === '/api/timekeeper/categories') return CATEGORIES;
    return [];
  });
  api.post.mockReset().mockResolvedValue({ message: 'Vygenerováno 2 závodníků' });
});

describe('startovní listina', () => {
  it('prázdná listina nabídne generování; pořadí kategorií jde změnit', async () => {
    renderScreen();
    expect(await screen.findByText('Startovní listina je prázdná')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Tisk startovní listiny' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Generovat z přihlášek' }));
    const panel = await screen.findByRole('complementary', { name: 'Generování listiny' });
    await within(panel).findByText('Myšáci dívky');
    await userEvent.click(
      within(panel).getByRole('button', { name: /Posunout Myšáci dívky.* dolů/ }),
    );

    rows = [
      {
        id: 1,
        start_number: 1,
        racer_name: 'Ema',
        racer_surname: 'Malá',
        category_id: 2,
        category_name: 'Myšáci chlapci',
        excluded: false,
      },
    ];
    await userEvent.click(within(panel).getByRole('button', { name: 'Vygenerovat listinu' }));

    expect(api.post).toHaveBeenCalledWith('/api/timekeeper/races/7/start-list/generate', {
      category_order: [2, 1],
    });
    expect(await screen.findByText('Malá Ema')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tisk startovní listiny' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Generování listiny' })).toBeNull();
  });

  it('bez vybraného závodu jen odkaz do Přehledu', () => {
    localStorage.clear();
    renderScreen();
    expect(screen.getByText('Vyberte závod')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generovat z přihlášek' })).toBeNull();
  });
});
