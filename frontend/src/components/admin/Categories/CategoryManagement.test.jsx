import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();
vi.mock('../../../config/api.js', () => ({
  AdminAPI: { get: (...a) => mockGet(...a), post: (...a) => mockPost(...a), put: (...a) => mockPut(...a), delete: (...a) => mockDelete(...a) },
}));
vi.mock('../../../config/auth.jsx', () => ({ useAuth: () => ({ loading: false, isAuthenticated: true }) }));

const { default: CategoryManagement } = await import('./CategoryManagement.jsx');

const CATEGORIES = [
  { id: 1, name: 'U8 Myšáci', display_name: 'Myšáci dívky', min_birth_year: 2020, max_birth_year: 2022, sex: 2, active: true, created_at: '2025-09-01' },
  { id: 2, name: 'OPEN', display_name: '', min_birth_year: 1940, max_birth_year: 2006, sex: 0, active: false, created_at: '2025-09-01' },
];

const COVERAGE = {
  status: 'warning', check_range: { min: 1968, max: 2026, total_years: 59 }, active_categories: 14, message: 'Nalezeny díry.',
  results_by_sex: {
    'Muži': { gap_ranges: [{ start: 2023, end: 2026, count: 4, message: 'Ročníky 2023–2026 nepokryty' }], overlap_details: [] },
    'Ženy': { gap_ranges: [], overlap_details: [] },
  },
};

describe('kategorie', () => {
  beforeEach(() => {
    mockGet.mockReset().mockImplementation((url) => Promise.resolve(url.includes('coverage') ? COVERAGE : CATEGORIES));
    mockPost.mockReset().mockResolvedValue({ stats: { total: 10, updated: 2, unchanged: 8, no_category: 0 }, updates: [] });
    mockPut.mockReset().mockResolvedValue({});
    mockDelete.mockReset().mockResolvedValue({});
  });

  it('vypíše kategorie se stavem slovy, mix nejde zrcadlit', async () => {
    render(<CategoryManagement />);
    const table = await screen.findByRole('table', { name: 'Kategorie' });
    expect(within(table).getByText('Myšáci dívky')).toBeInTheDocument();
    expect(within(table).getByText('Neaktivní')).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Kategorii OPEN pro muže i ženy nejde zrcadlit' })).toBeDisabled();
  });

  it('úprava v dialogu, nejstarší ročník mladší než nejmladší neuloží', async () => {
    render(<CategoryManagement />);
    await userEvent.click(await screen.findByRole('button', { name: 'Upravit kategorii Myšáci dívky' }));
    const dialog = screen.getByRole('dialog', { name: 'Upravit kategorii Myšáci dívky' });
    expect(within(dialog).getByRole('radio', { name: 'Ženy' })).toBeChecked();
    const oldest = within(dialog).getByRole('spinbutton', { name: /Nejstarší ročník/ });
    await userEvent.clear(oldest);
    await userEvent.type(oldest, '2024');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Uložit změny' }));
    expect(within(dialog).getByText('Nejstarší ročník musí být menší nebo roven nejmladšímu ročníku')).toBeInTheDocument();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('smazání se zeptá a Zrušit nic nesmaže', async () => {
    render(<CategoryManagement />);
    await userEvent.click(await screen.findByRole('button', { name: 'Smazat kategorii Myšáci dívky' }));
    const dialog = screen.getByRole('dialog', { name: 'Smazat kategorii Myšáci dívky?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Zrušit' }));
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('kontrola pokrytí ukáže výsledek po pohlavích', async () => {
    render(<CategoryManagement />);
    await userEvent.click(await screen.findByRole('button', { name: 'Kontrola pokrytí' }));
    const report = await screen.findByRole('region', { name: 'Kontrola pokrytí ročníků' });
    expect(within(report).getByText('Nepokryto: Ročníky 2023–2026 (4 let)')).toBeInTheDocument();
    expect(within(report).getByText('Všechny ročníky OK')).toBeInTheDocument();
  });

  it('přepočet se nejdřív zeptá a pak ukáže souhrn', async () => {
    render(<CategoryManagement />);
    await userEvent.click(await screen.findByRole('button', { name: 'Přepočítat kategorie' }));
    const dialog = screen.getByRole('dialog', { name: 'Přepočítat kategorie všech závodníků?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Přepočítat kategorie' }));
    expect(mockPost).toHaveBeenCalledWith('/api/admin/categories/recalculate/all', {});
    expect(await screen.findByRole('heading', { name: 'Přepočet kategorií dokončen' })).toBeInTheDocument();
  });
});
