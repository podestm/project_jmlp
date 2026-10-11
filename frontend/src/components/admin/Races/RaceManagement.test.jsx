import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();
vi.mock('../../../config/api.js', () => ({
  AdminAPI: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: vi.fn(),
    delete: (...args) => mockDelete(...args),
  },
  adminAuthHeaders: () => ({}),
}));
// Přílohy jsou samostatná obrazovka (Dokumenty), tady jen náhrada.
vi.mock('../attachments/AttachmentManager.jsx', () => ({
  default: ({ ownerId }) => <div data-testid="prilohy">{ownerId ?? 'nový'}</div>,
}));

const { default: RaceManagement } = await import('./RaceManagement.jsx');

const RACES = [
  {
    id: 7, datum: '2026-10-03', race_nr: 'JMLP2026-01', season_id: 2026, areal_name: 'Brno – Kohoutovice',
    organizer_name: 'FreeSki Academy Brno', registration: true, registrations_count: 58, race_method_id: 2,
    proposition_file_id: 5, results_file_id: null, is_final: false,
  },
  {
    id: 8, datum: '2027-03-01', race_nr: 'JMLP2026-07', season_id: 2026, areal_name: 'Velké Meziříčí – Fajťák',
    organizer_name: 'SKI KLUB JUNIOR BRNO', registration: false, registrations_count: 0, race_method_id: 1,
    proposition_file_id: null, results_file_id: null, is_final: true,
  },
];

const renderScreen = () => render(<MemoryRouter><RaceManagement /></MemoryRouter>);

describe('správa závodů', () => {
  beforeEach(() => {
    mockGet.mockReset().mockResolvedValue(RACES);
    mockPost.mockReset().mockResolvedValue({});
    mockDelete.mockReset().mockResolvedValue({});
  });

  it('vypíše závody v tabulce se souhrnem, finále a dokumenty', async () => {
    renderScreen();
    const table = await screen.findByRole('table', { name: 'Závody' });
    expect(within(table).getByText('Brno – Kohoutovice')).toBeInTheDocument();
    expect(within(table).getByText('FreeSki Academy Brno · suchý slalom')).toBeInTheDocument();
    expect(within(table).getByText('Finále')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Propozice' })).toHaveAttribute('href', '/races/7/proposition');
    expect(within(table).getAllByRole('link', { name: 'Přihlášky' })[0]).toHaveAttribute('href', '/admin/races/7/registrations');
    expect(screen.getByText('2 závody · 1 s otevřenou registrací')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sezóna 2026/27 — XX. ročník' })).toBeInTheDocument();
  });

  it('přepínač v řádku změní stav registrace', async () => {
    renderScreen();
    const table = await screen.findByRole('table', { name: 'Závody' });
    await userEvent.click(within(table).getByRole('switch', { name: 'Otevřená' }));
    expect(mockPost).toHaveBeenCalledWith('/api/admin/races/7/toggle-registration');
    expect(await screen.findByText('Stav registrace byl změněn')).toBeInTheDocument();
  });

  it('bez závodů ukáže prázdný stav', async () => {
    mockGet.mockResolvedValue([]);
    renderScreen();
    expect(await screen.findByText('Žádné závody nebyly nalezeny')).toBeInTheDocument();
  });

  it('Nový závod otevře prázdný formulář, Zpět na seznam ho zavře', async () => {
    renderScreen();
    await screen.findByRole('table', { name: 'Závody' });
    await userEvent.click(screen.getByRole('button', { name: 'Nový závod' }));
    expect(screen.getByRole('heading', { name: 'Přidat nový závod' })).toBeInTheDocument();
    expect(screen.getByTestId('prilohy')).toHaveTextContent('nový');
    expect(screen.getByRole('button', { name: 'Vytvořit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Smazat závod' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zpět na seznam' }));
    expect(screen.getByRole('table', { name: 'Závody' })).toBeInTheDocument();
  });

  it('úprava: finále jen u závodu na sněhu', async () => {
    renderScreen();
    const table = await screen.findByRole('table', { name: 'Závody' });
    await userEvent.click(within(table).getAllByRole('button', { name: 'Upravit' })[1]);
    expect(screen.getByRole('heading', { level: 2, name: 'Upravit závod' })).toBeInTheDocument();
    expect(screen.getByText('7. závod sezóny')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Areál' })).toHaveValue('Velké Meziříčí – Fajťák');
    const finale = screen.getByRole('checkbox', { name: 'Finále poháru' });
    expect(finale).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Suchý slalom' }));
    expect(screen.queryByRole('checkbox', { name: 'Finále poháru' })).not.toBeInTheDocument();
  });

  it('smazání se zeptá, vyjmenuje přihlášky a po Zrušit nic nesmaže', async () => {
    renderScreen();
    const table = await screen.findByRole('table', { name: 'Závody' });
    await userEvent.click(within(table).getAllByRole('button', { name: 'Upravit' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Smazat závod' }));
    const dialog = screen.getByRole('dialog', { name: 'Smazat závod Brno – Kohoutovice?' });
    expect(within(dialog).getByRole('button', { name: 'Smazat závod i 58 přihlášek' })).toBeInTheDocument();
    expect(within(dialog).getByText(/Dokumenty závodu se jen odpojí/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Zrušit' }));
    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 2, name: 'Upravit závod' })).toBeInTheDocument();
  });

  it('po potvrzeném smazání se formulář zavře', async () => {
    renderScreen();
    const table = await screen.findByRole('table', { name: 'Závody' });
    await userEvent.click(within(table).getAllByRole('button', { name: 'Upravit' })[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Smazat závod' }));
    const dialog = screen.getByRole('dialog', { name: 'Smazat závod Velké Meziříčí – Fajťák?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Smazat závod' }));
    expect(mockDelete).toHaveBeenCalledWith('/api/admin/races/8');
    expect(await screen.findByText('Závod byl úspěšně smazán')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Závody' })).toBeInTheDocument();
  });
});
