import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogout = vi.fn();
const mockGet = vi.fn();

vi.mock('../../../../config/auth.jsx', () => ({
  useAuth: () => ({
    admin: { full_name: 'Roman Keznikl', email: 'rk@x.cz', role: 'admin' },
    logout: mockLogout,
  }),
}));
vi.mock('../../../../config/api.js', () => ({ AdminAPI: { get: (...args) => mockGet(...args) } }));

const { default: AdminLayout } = await import('./AdminLayout.jsx');

const renderLayout = (path = '/admin') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AdminLayout>
        <div>obsah</div>
      </AdminLayout>
    </MemoryRouter>,
  );

describe('rámec administrace', () => {
  beforeEach(() => {
    mockLogout.mockReset();
    mockGet.mockReset().mockResolvedValue({ count: 0 });
  });

  it('postranní panel: položky v pořadí návrhu, aktivní podle adresy', () => {
    renderLayout('/admin/races');
    const sidebar = screen.getByRole('complementary', { name: 'Menu administrace' });
    const nav = within(sidebar).getByRole('navigation', { name: 'Administrace' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels.slice(0, 6)).toEqual([
      'Přehled',
      'Závody',
      'Závodníci',
      'Žádosti o kluby',
      'Dokumenty',
      'Aktuality',
    ]);
    expect(within(nav).getByRole('link', { name: 'Závody' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('obsah')).toBeInTheDocument();
  });

  it('počet nevyřízených žádostí o kluby a jeho obnova po vyřízení', async () => {
    mockGet.mockResolvedValue({ count: 3 });
    renderLayout();
    const sidebar = screen.getByRole('complementary', { name: 'Menu administrace' });
    expect(
      await within(sidebar).findByRole('link', { name: /Žádosti o kluby 3 čeká/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Otevřít menu administrace, 3 žádosti o kluby čekají' }),
    ).toBeInTheDocument();

    mockGet.mockResolvedValue({ count: 0 });
    await act(async () => {
      window.dispatchEvent(new Event('club-request-resolved'));
    });
    expect(within(sidebar).getByRole('link', { name: 'Žádosti o kluby' })).toBeInTheDocument();
  });

  it('přepínač sekcí vede do časomíry a odhlášení odhlásí', async () => {
    renderLayout();
    const sidebar = screen.getByRole('complementary', { name: 'Menu administrace' });
    const sw = within(sidebar).getByRole('navigation', { name: 'Přepnutí sekce' });
    expect(within(sw).getByRole('link', { name: /Časomíra/ })).toHaveAttribute(
      'href',
      '/timekeeper',
    );

    await userEvent.click(within(sidebar).getByRole('button', { name: 'Odhlásit se' }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('mobilní menu se otevře tlačítkem a zavře výběrem položky', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít menu administrace' }));
    const menu = screen.getByRole('dialog', { name: 'Menu administrace' });
    expect(within(menu).getByText('Roman Keznikl')).toBeInTheDocument();

    await userEvent.click(within(menu).getByRole('link', { name: 'Kluby' }));
    expect(screen.queryByRole('dialog', { name: 'Menu administrace' })).toBeNull();
  });
});
