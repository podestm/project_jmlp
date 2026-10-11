import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../../../config/api.js', () => ({ AdminAPI: { get: (...a) => mockGet(...a), post: (...a) => mockPost(...a) } }));

const { default: ClubRequests } = await import('./ClubRequests.jsx');

const REQUESTS = [
  { registration_id: 5, racer_name: 'Říha Ondřej', race_name: 'Brno – Kohoutovice', registered_at: '2026-10-03T11:47:00', club_request_note: 'SK Hodonín', current_club_name: null },
];
const CLUBS = [{ id: 1, name: 'SKI TEAM HODONÍN' }, { id: 2, name: 'SKI SKOL BRNO' }];

const renderScreen = () => render(<MemoryRouter><ClubRequests /></MemoryRouter>);

describe('žádosti o kluby', () => {
  beforeEach(() => {
    mockGet.mockReset().mockImplementation((url) => Promise.resolve(url.includes('requests') ? REQUESTS : CLUBS));
    mockPost.mockReset().mockResolvedValue({});
  });

  it('přiřazení existujícího klubu až po výběru, pak žádost zmizí a ohlásí se', async () => {
    const heard = vi.fn();
    window.addEventListener('club-request-resolved', heard);
    renderScreen();
    const card = await screen.findByRole('article', { name: 'Žádost Říha Ondřej' });
    const confirm = within(card).getByRole('button', { name: 'Potvrdit a přiřadit' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(card).getByRole('combobox', { name: 'Přiřadit ke klubu' }), 'hodo');
    await userEvent.click(screen.getByRole('option', { name: 'SKI TEAM HODONÍN' }));
    await userEvent.click(confirm);
    expect(mockPost).toHaveBeenCalledWith('/api/admin/clubs/requests/5/resolve', { club_id: 1 });
    expect(await screen.findByText('Žádné nevyřízené žádosti')).toBeInTheDocument();
    expect(heard).toHaveBeenCalled();
    window.removeEventListener('club-request-resolved', heard);
  });

  it('nový klub je předvyplněný tím, co závodník napsal', async () => {
    renderScreen();
    const card = await screen.findByRole('article', { name: 'Žádost Říha Ondřej' });
    await userEvent.click(within(card).getByRole('button', { name: 'Vytvořit nový klub' }));
    expect(within(card).getByRole('textbox', { name: 'Název nového klubu' })).toHaveValue('SK Hodonín');
    await userEvent.click(within(card).getByRole('button', { name: 'Potvrdit a přiřadit' }));
    expect(mockPost).toHaveBeenCalledWith('/api/admin/clubs/requests/5/resolve', { new_club_name: 'SK Hodonín' });
  });

  it('chyba vyřízení je hláška a žádost zůstane', async () => {
    mockPost.mockRejectedValue(new Error('Žádost nenalezena'));
    renderScreen();
    const card = await screen.findByRole('article', { name: 'Žádost Říha Ondřej' });
    await userEvent.click(within(card).getByRole('button', { name: 'Vytvořit nový klub' }));
    await userEvent.click(within(card).getByRole('button', { name: 'Potvrdit a přiřadit' }));
    expect(await screen.findByText('Žádost se nepodařilo vyřídit: Žádost nenalezena')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Žádost Říha Ondřej' })).toBeInTheDocument();
  });
});
