import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SectionSwitch from './SectionSwitch.jsx';

let mockUser = null;

vi.mock('../../config/timekeeperAuth.jsx', () => ({
  useTimekeeperAuth: () => ({ user: mockUser, logout: () => {} })
}));
vi.mock('../../offline/useSyncStatus.js', () => ({
  useSyncStatus: () => ({ syncState: 'online', queueStats: { total: 0 } })
}));
vi.mock('../../pdf/pdfmake.js', () => ({ preloadPdfMake: () => Promise.resolve(true) }));

const { default: TimekeeperLayout } = await import('../timekeeper/TimekeeperLayout.jsx');

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('přepínač Admin / Časomíra', () => {
  it('v administraci je zapnutý Admin a Časomíra vede do časomíry', () => {
    inRouter(<SectionSwitch current="admin" />);

    expect(screen.getByText('Admin').closest('[aria-current]')).not.toBeNull();
    expect(screen.queryByRole('link', { name: /Admin/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Časomíra/ })).toHaveAttribute('href', '/timekeeper');
  });

  it('v časomíře vypadá stejně, jen je zapnutá Časomíra', () => {
    inRouter(<SectionSwitch current="timekeeper" />);

    expect(screen.getByText('Časomíra').closest('[aria-current]')).not.toBeNull();
    expect(screen.queryByRole('link', { name: /Časomíra/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Admin/ })).toHaveAttribute('href', '/admin');
  });
});

describe('přepínač v menu časomíry', () => {
  it('správce ho má a přepne jím do administrace', () => {
    mockUser = { full_name: 'Správce', role: 'admin' };
    inRouter(<TimekeeperLayout><div>obsah</div></TimekeeperLayout>);

    expect(screen.getByRole('navigation', { name: 'Přepnutí sekce' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Admin/ })).toHaveAttribute('href', '/admin');
  });

  it('časoměřič bez práv správce ho nevidí - do administrace se nepřihlásí', () => {
    mockUser = { full_name: 'Časoměřič', role: 'timekeeper' };
    inRouter(<TimekeeperLayout><div>obsah</div></TimekeeperLayout>);

    expect(screen.queryByRole('navigation', { name: 'Přepnutí sekce' })).toBeNull();
    expect(screen.getByText('obsah')).toBeInTheDocument();
  });
});
