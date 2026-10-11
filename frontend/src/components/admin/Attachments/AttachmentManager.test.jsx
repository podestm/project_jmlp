import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockRemove = vi.fn();
const mockUpdate = vi.fn();
vi.mock('../../../config/attachmentsApi.js', async (importOriginal) => ({
  ...(await importOriginal()),
  AttachmentsAPI: {
    list: (...args) => mockList(...args),
    remove: (...args) => mockRemove(...args),
    update: (...args) => mockUpdate(...args),
    upload: vi.fn(),
    link: vi.fn(),
    library: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../../../config/libraryApi.js', () => ({ LibraryAPI: { rename: vi.fn() } }));

const { default: AttachmentManager } = await import('./AttachmentManager.jsx');

const PROPOZICE = {
  id: 11, file_id: 5, role: 'propozice', original_filename: 'Propozice_Kohoutovice.pdf', file_size: 188416,
  uploaded_at: '2026-09-14T10:00:00', download_url: '/uploads/documents/p.pdf', published: true,
};

describe('správce příloh', () => {
  beforeEach(() => {
    mockList.mockReset().mockResolvedValue([PROPOZICE]);
    mockRemove.mockReset().mockResolvedValue({});
    mockUpdate.mockReset().mockResolvedValue({});
  });

  it('neuložená věc jen vysvětlí, že dokumenty půjdou nahrát po uložení', () => {
    render(<AttachmentManager ownerType="race" ownerId={null} roles={['propozice']} />);
    expect(screen.getByText('Dokumenty půjde nahrát hned po prvním uložení.')).toBeInTheDocument();
    expect(mockList).not.toHaveBeenCalled();
  });

  it('obsazený slot ukáže soubor a přepínač, prázdný místo pro soubor', async () => {
    render(<AttachmentManager ownerType="race" ownerId={7} roles={['propozice', 'vysledky']} />);
    const propozice = await screen.findByRole('region', { name: 'Propozice' });
    expect(within(propozice).getByRole('link', { name: 'Propozice_Kohoutovice.pdf' })).toBeInTheDocument();
    expect(within(propozice).getByRole('switch', { name: 'Zveřejněno' })).toBeChecked();
    const vysledky = screen.getByRole('region', { name: 'Výsledky' });
    expect(within(vysledky).getByRole('button', { name: 'Vybrat z počítače' })).toBeInTheDocument();
  });

  it('odpojení nabídne ponechání souboru jako bezpečnou volbu', async () => {
    render(<AttachmentManager ownerType="race" ownerId={7} roles={['propozice']} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Odpojit dokument Propozice_Kohoutovice.pdf' }));
    const dialog = screen.getByRole('dialog', { name: 'Odpojit propozice?' });
    expect(within(dialog).getByRole('button', { name: 'Odpojit, soubor ponechat' })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Odpojit, soubor ponechat' }));
    expect(mockRemove).toHaveBeenCalledWith(11, { deleteFile: false });
  });
});
