import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SerialSessionProvider } from '../../SerialSessionProvider.jsx';

let mockUser = null;

vi.mock('../../../../config/timekeeperAuth.jsx', () => ({
  useTimekeeperAuth: () => ({ user: mockUser, logout: () => {} }),
}));
vi.mock('../../../../offline/useSyncStatus.js', () => ({
  useSyncStatus: () => ({
    isOnline: true,
    syncState: 'online',
    queueStats: { pending: 0, failed: 0, processing: 0, conflict: 0, dead: 0, total: 0 },
  }),
}));
vi.mock('../../../../pdf/pdfmake.js', () => ({ preloadPdfMake: () => Promise.resolve(true) }));

const { default: TimekeeperLayout } = await import('./TimekeeperLayout.jsx');

const renderLayout = () => render(
  <MemoryRouter>
    <SerialSessionProvider>
      <TimekeeperLayout><div>obsah</div></TimekeeperLayout>
    </SerialSessionProvider>
  </MemoryRouter>,
);

describe('rámec časomíry', () => {
  it('správce má přepínač sekcí a přepne jím do administrace', () => {
    mockUser = { full_name: 'Správce', role: 'admin' };
    renderLayout();

    const sw = screen.getByRole('navigation', { name: 'Přepnutí sekce' });
    expect(within(sw).getByRole('link', { name: /Admin/ })).toHaveAttribute('href', '/admin');
  });

  it('časoměřič bez práv správce ho nevidí - do administrace se nepřihlásí', () => {
    mockUser = { full_name: 'Časoměřič', role: 'timekeeper' };
    renderLayout();

    expect(screen.queryByRole('navigation', { name: 'Přepnutí sekce' })).toBeNull();
    expect(screen.getByText('obsah')).toBeInTheDocument();
  });

  it('tři stavy: online, prázdná fronta, zařízení', () => {
    mockUser = { full_name: 'Časoměřič', role: 'timekeeper' };
    renderLayout();

    const chips = screen.getByRole('group', { name: 'Stav časomíry' });
    expect(chips).toHaveTextContent('Online');
    expect(chips).toHaveTextContent('vše na serveru');
    expect(within(chips).getByRole('link', { name: /Fronta/ })).toHaveAttribute('href', '/timekeeper/sync');
  });

  it('bez vybraného závodu vyzve k výběru', () => {
    mockUser = { full_name: 'Časoměřič', role: 'timekeeper' };
    renderLayout();

    expect(screen.getByRole('link', { name: /Závod není vybraný/ })).toHaveAttribute('href', '/timekeeper');
  });
});
