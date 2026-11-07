import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SiteHeader from './SiteHeader.jsx';

const live = vi.hoisted(() => ({ race: null }));
vi.mock('../../../contexts/LiveStatusContext.jsx', () => ({ useLiveStatus: () => live.race }));

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SiteHeader />
    </MemoryRouter>,
  );

describe('SiteHeader', () => {
  it('šest položek menu, aktivní nese aria-current', () => {
    renderAt('/zavod/134');
    const nav = screen.getAllByRole('navigation', { name: 'Hlavní menu' })[0];
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Úvod',
      'Závody',
      'Výsledky',
      'Aktuality',
      'Dokumenty',
      'Kontakty',
    ]);
    expect(within(nav).getByRole('link', { name: 'Závody' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Úvod' })).not.toHaveAttribute('aria-current');
  });

  it('odznak ŽIVĚ je vidět i v klidu', () => {
    live.race = null;
    renderAt('/');
    expect(screen.getAllByRole('link', { name: 'Živě – právě se nezávodí' })[0]).toHaveAttribute(
      'href',
      '/zive',
    );
  });

  it('hamburger otevře mobilní menu a „Zavřít menu“ ho zavře', async () => {
    live.race = { race_id: 1, areal_name: 'Brno – Kohoutovice' };
    renderAt('/');
    const toggle = screen.getByRole('button', { name: 'Otevřít menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);
    const menu = screen.getByRole('dialog', { name: 'Menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu).getByRole('button', { name: 'Zavřít menu' })).toHaveFocus();
    expect(within(menu).getByRole('link', { name: /Živě · právě se závodí/ })).toHaveTextContent(
      'Brno – Kohoutovice',
    );
    expect(within(menu).getByRole('link', { name: 'Přihlásit na závod' })).toHaveAttribute(
      'href',
      '/zavody',
    );

    await userEvent.click(within(menu).getByRole('button', { name: 'Zavřít menu' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle).toHaveFocus();
  });

  it('výběr položky v mobilním menu menu zavře', async () => {
    renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít menu' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('link', { name: /Dokumenty/ }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
