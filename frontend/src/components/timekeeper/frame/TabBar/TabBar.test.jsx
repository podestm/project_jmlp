import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TabBar from './TabBar.jsx';

const renderBar = (user, onLogout = vi.fn()) => {
  render(<MemoryRouter initialEntries={['/timekeeper/start-list']}><TabBar user={user} onLogout={onLogout} /></MemoryRouter>);
  return onLogout;
};

describe('TabBar', () => {
  it('položky v pořadí závodního dne, aktivní podle adresy', () => {
    renderBar({ full_name: 'Petr Novotný', role: 'timekeeper' });
    const nav = screen.getByRole('navigation', { name: 'Časomíra' });
    const links = within(nav).getAllByRole('link').map((link) => link.textContent);
    expect(links).toEqual([
      'Přehled', 'Detail závodu', 'Závodníci', 'Startovní listina', 'Zadávání časů', 'Výsledky',
      'Čísla', 'Synchronizace', 'Zařízení',
    ]);
    expect(within(nav).getByRole('link', { name: 'Startovní listina' })).toHaveAttribute('aria-current', 'page');
  });

  it('časoměřič nemá přepínač sekcí, správce ano', () => {
    renderBar({ full_name: 'Petr Novotný', role: 'timekeeper' });
    expect(screen.queryByRole('navigation', { name: 'Přepnutí sekce' })).not.toBeInTheDocument();
    expect(screen.getByText('Časoměřič')).toBeInTheDocument();
  });

  it('správce přepne do administrace', () => {
    renderBar({ full_name: 'Jana Svobodová', role: 'admin' });
    const sw = screen.getByRole('navigation', { name: 'Přepnutí sekce' });
    expect(within(sw).getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  it('odhlášení', async () => {
    const onLogout = renderBar({ email: 'a@b.cz', role: 'timekeeper' });
    await userEvent.click(screen.getByRole('button', { name: 'Odhlásit se' }));
    expect(onLogout).toHaveBeenCalled();
  });
});
