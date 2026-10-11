import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PostManagement from './PostManagement.jsx';

/**
 * Uložení příspěvku nesmí odpojit přílohy.
 *
 * Vzniklo po hlášení z provozu: "obrázek k postu jde přidat, nahraje se do
 * úložiště, ale po uložení se od postu odpojí". Obrázek a dokument připojuje
 * AttachmentManager rovnou přes /api/admin/attachments, jenže formulář při
 * uložení posílal i image_file_id / document_file_id ze stavu, kdy se otevřel
 * (tedy prázdné). Backend bere null jako "odpojit", takže přílohu připojenou
 * mezitím zase zahodil.
 */
const PRISPEVEK = {
  id: 7,
  title: 'Pozvánka na závod',
  content: 'Přijďte fandit',
  published: true,
  image_position: 'right',
  // Stav seznamu z doby před nahráním obrázku
  image_file_id: null,
  document_file_id: null,
  created_at: '2026-09-01T10:00:00',
  updated_at: '2026-09-01T10:00:00',
};

const OBRAZEK = {
  id: 31,
  file_id: 55,
  owner_type: 'post',
  owner_id: 7,
  role: 'image',
  published: true,
  original_filename: 'pozvanka.jpg',
  file_size: 1024,
  download_url: '/uploads/documents/pozvanka.jpg',
};

let volani;

const jsonResponse = (body) => Promise.resolve({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => body,
});

beforeEach(() => {
  volani = [];
  localStorage.setItem('auth_token', 'token-pro-test');
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    const cesta = String(url);
    const metoda = options.method || 'GET';
    const telo = typeof options.body === 'string' ? JSON.parse(options.body) : null;
    volani.push({ cesta, metoda, telo });

    if (metoda === 'PUT' && cesta.includes('/api/admin/posts/')) {
      return jsonResponse({ ...PRISPEVEK, ...telo, image_file_id: 55 });
    }
    if (metoda === 'POST' && cesta.includes('/api/admin/posts')) {
      return jsonResponse({ ...PRISPEVEK, id: 8, ...telo });
    }
    if (cesta.includes('/api/admin/posts')) return jsonResponse([PRISPEVEK]);
    // Obrázek je u příspěvku 7 připojený - jako by ho uživatel právě nahrál.
    if (cesta.includes('/api/admin/attachments') && cesta.includes('owner_id=7')) {
      return jsonResponse([OBRAZEK]);
    }
    return jsonResponse([]);
  }));
});

const ulozeni = (metoda) => volani.filter(
  (v) => v.metoda === metoda && v.cesta.includes('/api/admin/posts')
);

describe('PostManagement', () => {
  it('uložení upraveného příspěvku neposílá obrázek ani dokument', async () => {
    const user = userEvent.setup();
    render(<PostManagement />);

    await user.click(await screen.findByRole('button', { name: 'Upravit příspěvek Pozvánka na závod' }));
    // Přílohu ukazuje AttachmentManager z /api/admin/attachments
    expect(await screen.findByText('pozvanka.jpg')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Uložit příspěvek' }));

    await waitFor(() => expect(ulozeni('PUT')).toHaveLength(1));
    const telo = ulozeni('PUT')[0].telo;
    expect(telo).toEqual({
      title: 'Pozvánka na závod',
      content: 'Přijďte fandit',
      published: true,
      image_position: 'right',
    });
    expect(telo).not.toHaveProperty('image_file_id');
    expect(telo).not.toHaveProperty('document_file_id');
  });

  it('nový příspěvek po uložení zůstane otevřený, aby šly připojit přílohy', async () => {
    const user = userEvent.setup();
    render(<PostManagement />);

    await user.click(await screen.findByRole('button', { name: 'Nový příspěvek' }));
    expect(screen.getByText('Dokumenty půjde nahrát hned po prvním uložení.')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Zadejte nadpis příspěvku...'), 'Výsledky 1. kola');
    await user.type(screen.getByPlaceholderText('Napište obsah příspěvku...'), 'Gratulujeme');
    await user.click(screen.getByRole('button', { name: 'Vytvořit příspěvek' }));

    await waitFor(() => expect(ulozeni('POST')).toHaveLength(1));
    expect(ulozeni('POST')[0].telo).not.toHaveProperty('image_file_id');

    // Okno je teď úprava uloženého příspěvku a nabízí nahrání příloh
    expect(await screen.findByRole('heading', { level: 1, name: 'Upravit příspěvek' })).toBeInTheDocument();
    expect(screen.queryByText('Dokumenty půjde nahrát hned po prvním uložení.')).not.toBeInTheDocument();
    expect(await screen.findAllByRole('button', { name: 'Vybrat z knihovny' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Uložit příspěvek' })).toBeInTheDocument();
  });

  it('smazání se ptá dialogem a Enter nic nesmaže', async () => {
    const user = userEvent.setup();
    render(<PostManagement />);

    await user.click(await screen.findByRole('button', { name: 'Smazat příspěvek Pozvánka na závod' }));
    expect(screen.getByRole('dialog', { name: 'Smazat příspěvek „Pozvánka na závod“?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zrušit' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(ulozeni('DELETE')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Smazat příspěvek Pozvánka na závod' }));
    await user.click(screen.getByRole('button', { name: 'Smazat příspěvek' }));
    await waitFor(() => expect(ulozeni('DELETE')).toHaveLength(1));
  });
});
