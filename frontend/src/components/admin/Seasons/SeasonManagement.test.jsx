import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
const mockDelete = vi.fn();
vi.mock('../../../config/api.js', () => ({
  AdminAPI: { get: (...a) => mockGet(...a), delete: (...a) => mockDelete(...a), put: vi.fn(), post: vi.fn() },
}));
vi.mock('../Attachments/AttachmentManager.jsx', () => ({ default: ({ title }) => <div>{title}</div> }));

const { default: SeasonManagement } = await import('./SeasonManagement.jsx');

const SEASONS = [
  { id: 16, year_start: 2027, year_end: 2028, edition: 21, edition_label: 'XXI.', season_label: '2027/2028', name: 'JMLP', active: true, races_count: 0, documents_count: 0 },
  { id: 15, year_start: 2026, year_end: 2027, edition: 20, edition_label: 'XX.', season_label: '2026/2027', name: 'JMLP', active: true, races_count: 2, documents_count: 2 },
  { id: 14, year_start: 2025, year_end: 2026, edition: 19, edition_label: 'XIX.', season_label: '2025/2026', name: 'JMLP', active: true, races_count: 7, documents_count: 5 },
];

describe('sezóny', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T12:00:00'));
    mockGet.mockReset().mockResolvedValue(SEASONS);
    mockDelete.mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rozdělí běžící a připravené od archivu, sezónu se závody nejde smazat', async () => {
    render(<SeasonManagement />);
    const current = await screen.findByRole('article', { name: 'Sezóna 2026/2027' });
    expect(within(current).getByText('Aktuální sezóna')).toBeInTheDocument();
    expect(within(current).getByRole('button', { name: /má závody a nelze ji smazat/ })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Archiv ročníků' })).toBeInTheDocument();
    expect(screen.getByText('3 ročníky v databázi · XX. ročník právě běží')).toBeInTheDocument();
  });

  it('dokumenty se rozbalí u sezóny', async () => {
    render(<SeasonManagement />);
    const card = await screen.findByRole('article', { name: 'Sezóna 2025/2026' });
    await userEvent.click(within(card).getByRole('button', { name: 'Dokumenty' }));
    expect(within(card).getByText('Dokumenty sezóny 2025/2026')).toBeInTheDocument();
  });

  it('úprava v dialogu se zamčeným rokem', async () => {
    render(<SeasonManagement />);
    await userEvent.click(await screen.findByRole('button', { name: 'Upravit sezónu 2026/2027' }));
    const dialog = screen.getByRole('dialog', { name: 'Upravit sezónu 2026/2027' });
    expect(within(dialog).getByRole('spinbutton', { name: /Počáteční rok/ })).toBeDisabled();
    expect(within(dialog).getByText('XX.')).toBeInTheDocument();
  });

  it('smazání prázdné sezóny se zeptá a Zrušit nic nesmaže', async () => {
    render(<SeasonManagement />);
    await userEvent.click(await screen.findByRole('button', { name: 'Smazat sezónu 2027/2028' }));
    const dialog = screen.getByRole('dialog', { name: 'Smazat sezónu 2027/2028?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Zrušit' }));
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
