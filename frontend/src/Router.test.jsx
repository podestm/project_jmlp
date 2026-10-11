import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppRouter from './Router.jsx';

/**
 * Staré adresy veřejného webu žijí v záložkách a odkazech v e-mailech –
 * musí vést na nové stránky, ne na 404. Neznámá adresa dostane stránku 404
 * v rámci webu.
 */
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

const openAt = (path) => {
  window.history.pushState({}, '', path);
  render(<AppRouter />);
};

describe('veřejné routy', () => {
  it.each([
    ['/archiv-zprav', '/aktuality'],
    ['/registrace', '/zavody'],
  ])('%s přesměruje na %s', async (from, to) => {
    openAt(from);
    await waitFor(() => expect(window.location.pathname).toBe(to));
  });

  it('/livetiming přesměruje na /zive', async () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    openAt('/livetiming');
    await waitFor(() => expect(replace.mock.calls.some(([, , url]) => url === '/zive')).toBe(true));
  });

  it('neznámá adresa ukáže 404 v rámci webu', async () => {
    openAt('/tohle-neexistuje');
    expect(await screen.findByRole('heading', { level: 1, name: /Tady nic není/ })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Hlavní menu' }).length).toBeGreaterThan(0);
  });

  it('/vysledky má poctivý prázdný stav', async () => {
    openAt('/vysledky');
    expect(await screen.findByRole('heading', { level: 1, name: 'Výsledky a pořadí' })).toBeInTheDocument();
  });
});
