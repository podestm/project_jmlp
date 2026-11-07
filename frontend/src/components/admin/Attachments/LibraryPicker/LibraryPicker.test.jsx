import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LibraryPicker from './LibraryPicker.jsx';
import { AttachmentsAPI } from '../../../../config/attachmentsApi.js';

vi.mock('../../../../config/attachmentsApi.js', async (importOriginal) => ({
  ...(await importOriginal()),
  AttachmentsAPI: { library: vi.fn() },
}));

const SOUBORY = [
  { id: 1, original_filename: 'propozice-kohoutovice.pdf', file_size: 2048, uploaded_at: '2026-09-01T10:00:00', usage_info: [] },
  { id: 2, original_filename: 'foto-start.jpg', file_size: 4096, uploaded_at: '2026-09-02T10:00:00', usage_info: [] },
];

beforeEach(() => {
  AttachmentsAPI.library.mockResolvedValue(SOUBORY);
});

describe('LibraryPicker', () => {
  it('je dialog s fokusem v hledání a filtruje podle přípony i názvu', async () => {
    const onSelect = vi.fn();
    render(<LibraryPicker accept=".pdf" onSelect={onSelect} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Vybrat z knihovny' })).toBeInTheDocument();
    expect(screen.getByLabelText('Hledat podle názvu')).toHaveFocus();
    await userEvent.click(await screen.findByRole('button', { name: /propozice-kohoutovice\.pdf/ }));
    expect(onSelect).toHaveBeenCalledWith(SOUBORY[0]);
    expect(screen.queryByText('foto-start.jpg')).toBeNull();
  });

  it('Zavřít i křížek dialog zavírají', async () => {
    const onClose = vi.fn();
    render(<LibraryPicker onSelect={vi.fn()} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Zavřít' }));
    await userEvent.click(screen.getByRole('button', { name: 'Zavřít dialog' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
