import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home.jsx';

vi.mock('../../../contexts/LiveStatusContext.jsx', () => ({ useLiveStatus: () => null }));

const RACES = [
  { id: 2, race_nr: 'JMLP2026-02', datum: '2026-10-10', registration: false, race_method_id: 2, areal_name: 'Kraví hora', organizer_name: 'SKI KLUB JUNIOR BRNO' },
  { id: 1, race_nr: 'JMLP2026-01', datum: '2026-10-03', registration: true, race_method_id: 2, areal_name: 'Kohoutovice', organizer_name: 'FreeSki Academy Brno' },
];
const POSTS = [{ id: 5, title: 'Jubilejní XX. sezóna JMLP začíná', content: 'Zahajujeme.', created_at: '2026-09-16T10:00:00' }];

const json = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, statusText: '', json: async () => body });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-23T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

const renderHome = () => render(<MemoryRouter><Home /></MemoryRouter>);

describe('Home', () => {
  it('nejbližší závod, sezóna a aktuality', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => json(String(url).includes('/posts/') ? POSTS : RACES)));
    renderHome();

    expect(screen.getByRole('heading', { level: 1, name: 'Jihomoravský Lyžařský Pohár' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Přihlásit závodníka' })).toHaveAttribute('href', '/zavod/1#prihlaska');
    const season = screen.getByRole('region', { name: /Sezóna/ });
    const rows = within(season).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Kohoutovice');
    expect(rows[1]).toHaveTextContent('Registrace uzavřena');
    expect(await screen.findByRole('heading', { name: 'Jubilejní XX. sezóna JMLP začíná' })).toBeInTheDocument();
  });

  it('výpadek závodů je chyba, ne prázdná sezóna', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => (String(url).includes('/posts/') ? json([]) : json({}, false))));
    renderHome();

    expect(await screen.findByText('Závody se nepodařilo načíst')).toBeInTheDocument();
    expect(await screen.findByText('Zatím tu nejsou žádné aktuality')).toBeInTheDocument();
  });
});
