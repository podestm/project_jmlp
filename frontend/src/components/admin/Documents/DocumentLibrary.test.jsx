import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockSeasons = vi.fn();
const mockRemove = vi.fn();
const mockPublish = vi.fn();
vi.mock('../../../config/libraryApi.js', () => ({
  OWNER_FILTERS: [{ value: '', label: 'Kdekoli' }, { value: 'library', label: 'Nikde nepoužité' }],
  LibraryAPI: {
    list: (...args) => mockList(...args),
    seasons: (...args) => mockSeasons(...args),
    remove: (...args) => mockRemove(...args),
    publishToSeason: (...args) => mockPublish(...args),
    rename: vi.fn(),
    exportZip: vi.fn(),
  },
}));

const { default: DocumentLibrary } = await import('./DocumentLibrary.jsx');

const FILES = [
  { id: 1, original_filename: 'IMG_2291.jpg', file_size: 2202009, uploaded_at: '2026-09-20T10:00:00', download_url: '/uploads/documents/a.jpg', usage_info: [] },
  {
    id: 2, original_filename: 'Soutěžní řád.pdf', file_size: 216985, uploaded_at: '2026-09-16T10:00:00', download_url: '/uploads/documents/b.pdf',
    usage_info: [{ type: 'Sezóna', title: '2026/2027', owner_type: 'season', owner_id: 2026, role: 'document', published: true }],
  },
];
const SEASONS = [
  { year_start: 2026, season_label: '2026/2027', edition_label: 'XX.', active: true, documents_count: 2 },
  { year_start: 2025, season_label: '2025/2026', edition_label: 'XIX.', active: false, documents_count: 5 },
];

const renderScreen = () => render(<MemoryRouter><DocumentLibrary /></MemoryRouter>);

describe('knihovna dokumentů', () => {
  beforeEach(() => {
    mockList.mockReset().mockResolvedValue({ files: FILES, total: 96 });
    mockSeasons.mockReset().mockResolvedValue(SEASONS);
    mockRemove.mockReset().mockResolvedValue({});
    mockPublish.mockReset().mockResolvedValue({});
  });

  it('vypíše soubory s použitím a souhrnem', async () => {
    renderScreen();
    const table = await screen.findByRole('table', { name: 'Soubory knihovny' });
    expect(within(table).getByRole('link', { name: 'IMG_2291.jpg' })).toBeInTheDocument();
    expect(within(table).getByText('Nikde se nepoužívá')).toBeInTheDocument();
    expect(within(table).getByText('Sezóna · zveřejněno')).toBeInTheDocument();
    expect(screen.getByText(/Zobrazeno/)).toHaveTextContent('Zobrazeno 2 z 96 souborů');
  });

  it('prázdná knihovna ukáže prázdný stav', async () => {
    mockList.mockResolvedValue({ files: [], total: 0 });
    renderScreen();
    expect(await screen.findByText('Knihovna je prázdná')).toBeInTheDocument();
  });

  it('smazání použitého souboru vyjmenuje místa a po Zrušit nic nesmaže', async () => {
    renderScreen();
    await screen.findByRole('table', { name: 'Soubory knihovny' });
    await userEvent.click(screen.getByRole('button', { name: 'Smazat soubor Soutěžní řád.pdf' }));
    const dialog = screen.getByRole('dialog', { name: 'Smazat soubor „Soutěžní řád.pdf“?' });
    expect(within(dialog).getByText('Sezóna – 2026/2027')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Zrušit' })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Zrušit' }));
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('smazání nepoužitého souboru po potvrzení', async () => {
    renderScreen();
    await screen.findByRole('table', { name: 'Soubory knihovny' });
    await userEvent.click(screen.getByRole('button', { name: 'Smazat soubor IMG_2291.jpg' }));
    const dialog = screen.getByRole('dialog', { name: 'Smazat soubor „IMG_2291.jpg“?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Smazat soubor' }));
    expect(mockRemove).toHaveBeenCalledWith(1, { force: false });
  });

  it('zveřejnění: výběr sezóny, výchozí aktuální', async () => {
    renderScreen();
    await screen.findByRole('table', { name: 'Soubory knihovny' });
    await userEvent.click(screen.getByRole('button', { name: 'Zveřejnit soubor IMG_2291.jpg na webu' }));
    const dialog = screen.getByRole('dialog', { name: 'Zveřejnit „IMG_2291.jpg“ na webu?' });
    expect(within(dialog).getByRole('radio', { name: /2026\/2027 · XX\. ročník/ })).toBeChecked();
    await userEvent.click(within(dialog).getByRole('radio', { name: /2025\/2026/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Zveřejnit u sezóny 2025/2026' }));
    expect(mockPublish).toHaveBeenCalledWith(1, 2025);
  });
});
