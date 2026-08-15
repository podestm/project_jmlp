import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClubManagement from './ClubManagement.jsx';

/**
 * Rozbalení klubu nesmí rozjet nekonečné překreslování.
 *
 * Vzniklo po hlášení z provozu: "když kliknu na nahrát logo, začne všechno
 * problikávat". AttachmentManager po načtení příloh volá onChange, rodič na to
 * znovu načte kluby a přepne se do stavu loading - jenže spinner nahradil celou
 * tabulku, takže se AttachmentManager odpojil, po návratu připojil znovu a celé
 * kolo se opakovalo pořád dokola.
 */
const KLUBY = [
  { id: 1, name: 'SK Olešnice', valid: true, racers_count: 12, organized_races_count: 3, has_logo: false },
  { id: 2, name: 'Ski Klub Brno', valid: true, racers_count: 8, organized_races_count: 0, has_logo: true },
];

let volani;

const jsonResponse = (body) => Promise.resolve({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => body,
});

beforeEach(() => {
  volani = [];
  localStorage.setItem('admin_token', 'token-pro-test');
  vi.stubGlobal('fetch', vi.fn((url) => {
    const cesta = String(url);
    volani.push(cesta);
    if (cesta.includes('/api/admin/clubs/overview')) return jsonResponse(KLUBY);
    if (cesta.includes('/api/admin/attachments')) return jsonResponse([]);
    return jsonResponse([]);
  }));
});

const pocet = (fragment) => volani.filter((u) => u.includes(fragment)).length;

describe('ClubManagement', () => {
  it('vypíše kluby', async () => {
    render(<ClubManagement />);
    expect(await screen.findByText('SK Olešnice')).toBeInTheDocument();
  });

  it('rozbalení klubu nespustí nekonečné načítání', async () => {
    const user = userEvent.setup();
    render(<ClubManagement />);
    await screen.findByText('SK Olešnice');

    const prvniNacteni = pocet('/api/admin/clubs/overview');
    await user.click(screen.getByRole('button', { name: /Nahrát logo/ }));
    await screen.findAllByText(/Logo klubu/);

    // Chvíli počkáme - smyčka by se projevila růstem počtu volání.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const poRozbaleni = pocet('/api/admin/clubs/overview');
    expect(poRozbaleni - prvniNacteni).toBeLessThanOrEqual(1);
    expect(pocet('/api/admin/attachments')).toBeLessThanOrEqual(2);
  });

  it('tabulka při obnovení na pozadí nezmizí', async () => {
    const user = userEvent.setup();
    render(<ClubManagement />);
    await screen.findByText('SK Olešnice');

    await user.click(screen.getByRole('button', { name: /Nahrát logo/ }));

    // Právě zmizení tabulky odpojovalo AttachmentManager a rozjelo smyčku.
    await waitFor(() => expect(screen.getAllByText(/Logo klubu/).length).toBeGreaterThan(0));
    expect(screen.getByText('SK Olešnice')).toBeInTheDocument();
  });
});
