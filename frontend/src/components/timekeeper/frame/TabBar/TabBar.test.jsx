import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TabBar from './TabBar.jsx';

const renderBar = (user, onLogout = vi.fn(), path = '/timekeeper/start-list') => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <TabBar user={user} onLogout={onLogout} />
    </MemoryRouter>,
  );
  return onLogout;
};

describe('TabBar', () => {
  it('položky v pořadí závodního dne, aktivní podle adresy', () => {
    renderBar({ full_name: 'Petr Novotný', role: 'timekeeper' });
    const nav = screen.getByRole('navigation', { name: 'Časomíra' });
    const links = within(nav).getAllByRole('link');
    const names = [
      'Přehled',
      'Detail závodu',
      'Závodníci',
      'Startovní listina',
      'Zadávání časů',
      'Výsledky',
      'Čísla',
      'Synchronizace',
      'Zařízení',
    ];
    expect(links).toHaveLength(names.length);
    links.forEach((link, index) => expect(link).toHaveAccessibleName(names[index]));
    expect(within(nav).getByRole('link', { name: 'Startovní listina' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('na tabletu krátký popisek, celý název pro čtečku', () => {
    renderBar({ full_name: 'Petr Novotný', role: 'timekeeper' });
    const link = screen.getByRole('link', { name: 'Startovní listina' });
    expect(within(link).getByText('Startovka')).toHaveAttribute('aria-hidden', 'true');
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

  it('když se taby nevejdou, lišta se posune na aktivní tab', () => {
    const size = (prop, value) =>
      vi.spyOn(HTMLElement.prototype, prop, 'get').mockImplementation(function get() {
        return this.tagName === 'NAV' ? value.nav : value.tab;
      });
    size('scrollWidth', { nav: 600, tab: 60 });
    size('clientWidth', { nav: 400, tab: 60 });
    size('offsetWidth', { nav: 400, tab: 60 });
    size('offsetLeft', { nav: 0, tab: 500 });
    renderBar({ full_name: 'Petr Novotný', role: 'timekeeper' }, vi.fn(), '/timekeeper/sync');
    expect(screen.getByRole('navigation', { name: 'Časomíra' }).scrollLeft).toBe(330);
    vi.restoreAllMocks();
  });
});
