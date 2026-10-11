import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SerialSessionProvider } from '../../SerialSessionProvider.jsx';
import TkMobileMenu from './TkMobileMenu.jsx';

const race = { id: 7, areal_name: 'Brno – Kohoutovice', datum: '2026-10-03' };

const renderMenu = ({ user = { full_name: 'Petr Novotný', role: 'timekeeper' }, onClose = vi.fn() } = {}) => {
  render(
    <MemoryRouter initialEntries={['/timekeeper/timing']}>
      <SerialSessionProvider>
        <TkMobileMenu id="m" open onClose={onClose} race={race} user={user} onLogout={vi.fn()} />
      </SerialSessionProvider>
    </MemoryRouter>,
  );
  return onClose;
};

describe('TkMobileMenu', () => {
  it('měřený závod, stavy a očíslované kroky', () => {
    renderMenu();
    const menu = screen.getByRole('dialog', { name: 'Menu časomíry' });
    expect(within(menu).getByText('Brno – Kohoutovice')).toBeInTheDocument();
    expect(within(menu).getByRole('group', { name: 'Stav časomíry' })).toBeInTheDocument();
    const step = within(menu).getByRole('link', { name: /Zadávání časů/ });
    expect(step).toHaveAttribute('aria-current', 'page');
    expect(step).toHaveTextContent('5');
    expect(within(menu).queryByRole('navigation', { name: 'Přepnutí sekce' })).not.toBeInTheDocument();
  });

  it('správce má přepínač sekcí', () => {
    renderMenu({ user: { full_name: 'Jana Svobodová', role: 'admin' } });
    expect(screen.getByRole('navigation', { name: 'Přepnutí sekce' })).toBeInTheDocument();
  });

  it('výběr položky menu zavře', async () => {
    const onClose = renderMenu();
    await userEvent.click(screen.getByRole('link', { name: /Čísla/ }));
    expect(onClose).toHaveBeenCalledWith('navigate');
  });
});
