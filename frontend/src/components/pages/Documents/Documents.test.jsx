import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Documents from './Documents.jsx';

const json = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, statusText: '', json: async () => body });
const doc = (id, title) => ({ id, title, original_filename: title, file_size: 151379, url: `/uploads/documents/${id}.pdf` });
const renderPage = () => render(<MemoryRouter><Documents /></MemoryRouter>);

describe('Documents', () => {
  it('aktuální ročník a archiv s ročníkem', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({
      current: { season_year_start: 2026, season_year_end: 2027, edition_label: 'XX.', documents: [doc(1, 'Pokyny JMLP 26-27.pdf')] },
      archive: [{ season_year_start: 2025, season_year_end: 2026, edition_label: 'XIX.', documents: [doc(2, 'Soutěžní řád 2025-2026.pdf')] }],
    })));
    renderPage();

    expect(await screen.findByRole('link', { name: 'Stáhnout Pokyny JMLP 26-27' })).toHaveAttribute('href', '/uploads/documents/1.pdf');
    expect(screen.getByText('XX. ročník · PDF · 147.8 KB')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /XIX\. 2025\/26/ })).toHaveAttribute('href', '/uploads/documents/2.pdf');
  });

  it('chyba a prázdno jsou různé stavy', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({}, false)));
    const { unmount } = renderPage();
    expect(await screen.findByText('Dokumenty se nepodařilo načíst')).toBeInTheDocument();
    unmount();

    vi.stubGlobal('fetch', vi.fn(() => json({ current: null, archive: [] })));
    renderPage();
    expect(await screen.findByText('Zatím tu nejsou žádné dokumenty')).toBeInTheDocument();
  });
});
