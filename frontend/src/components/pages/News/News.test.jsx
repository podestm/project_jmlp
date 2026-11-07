import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import News from './News.jsx';

const post = (id, title, created) => ({ id, title, content: `Text ${title}`, created_at: created });
const json = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, statusText: '', json: async () => body });
const renderNews = () => render(<MemoryRouter><News /></MemoryRouter>);

describe('News', () => {
  it('příspěvky po rocích, hledání bez výsledku nabídne vymazat filtry', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json([post(1, 'Olešnice', '2026-01-28'), post(2, 'Nový web', '2025-10-13')])));
    renderNews();

    expect(await screen.findByRole('heading', { name: /^2026/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nový web' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Hledat v příspěvcích'), 'štafeta');
    expect(screen.getByText('Hledání nic nenašlo')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /Vymazat filtry/ })[0]);
    expect(screen.getByRole('heading', { name: 'Olešnice' })).toBeInTheDocument();
  });

  it('prázdný archiv a chyba načtení jsou různé stavy', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json([])));
    const { unmount } = renderNews();
    expect(await screen.findByText('Zatím tu nejsou žádné zprávy')).toBeInTheDocument();
    unmount();

    vi.stubGlobal('fetch', vi.fn(() => json({}, false)));
    renderNews();
    expect(await screen.findByText('Zprávy se teď nepodařilo načíst')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });
});
