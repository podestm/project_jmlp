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
  { id: 3, name: 'Bez klubové příslušnosti', valid: false, racers_count: 4, organized_races_count: 0, has_logo: true },
  { id: 4, name: 'SK Zaniklý', valid: false, racers_count: 0, organized_races_count: 0, has_logo: true },
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
  localStorage.setItem('auth_token', 'token-pro-test');
  vi.stubGlobal('fetch', vi.fn((url, options) => {
    const cesta = String(url);
    volani.push({ cesta, metoda: options?.method || 'GET' });
    if (options?.method === 'DELETE') {
      return jsonResponse({
        deleted_id: 3, name: 'Bez klubové příslušnosti',
        moved_racers: cesta.includes('reassign_to') ? 4 : 0,
        moved_races: 0,
        reassigned_to: cesta.includes('reassign_to') ? 1 : null,
        reassigned_to_name: cesta.includes('reassign_to') ? 'SK Olešnice' : null,
      });
    }
    if (cesta.includes('/api/admin/clubs/overview')) return jsonResponse(KLUBY);
    if (cesta.includes('/api/admin/attachments')) return jsonResponse([]);
    return jsonResponse([]);
  }));
});

const pocet = (fragment) => volani.filter((v) => v.cesta.includes(fragment)).length;
const smazani = () => volani.filter((v) => v.metoda === 'DELETE');

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

  it('filtruje podle cedulky neplatný', async () => {
    const user = userEvent.setup();
    render(<ClubManagement />);
    await screen.findByText('SK Olešnice');

    await user.selectOptions(screen.getByLabelText('Platnost klubu'), 'neplatne');
    expect(screen.getByText('Bez klubové příslušnosti')).toBeInTheDocument();
    expect(screen.queryByText('SK Olešnice')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Platnost klubu'), 'platne');
    expect(screen.getByText('SK Olešnice')).toBeInTheDocument();
    expect(screen.queryByText('SK Zaniklý')).not.toBeInTheDocument();
  });

  it('filtr platnosti se kombinuje s hledáním', async () => {
    const user = userEvent.setup();
    render(<ClubManagement />);
    await screen.findByText('SK Olešnice');

    await user.selectOptions(screen.getByLabelText('Platnost klubu'), 'neplatne');
    await user.type(screen.getByPlaceholderText('Hledat klub…'), 'zanikl');

    expect(screen.getByText('SK Zaniklý')).toBeInTheDocument();
    expect(screen.queryByText('Bez klubové příslušnosti')).not.toBeInTheDocument();
  });

  it('prázdný klub smaže rovnou, bez výběru cíle', async () => {
    const user = userEvent.setup();
    render(<ClubManagement />);
    await screen.findByText('SK Zaniklý');

    await user.click(screen.getByRole('button', { name: 'Smazat klub SK Zaniklý' }));
    expect(screen.getByText(/převádět není co/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Smazat klub' }));

    await waitFor(() => expect(smazani()).toHaveLength(1));
    expect(smazani()[0].cesta).toContain('/api/admin/clubs/4');
    expect(smazani()[0].cesta).not.toContain('reassign_to');
  });

  it('klub se závodníky jde smazat až po výběru cílového klubu', async () => {
    const user = userEvent.setup();
    render(<ClubManagement />);
    await screen.findByText('Bez klubové příslušnosti');

    await user.click(screen.getByRole('button', { name: 'Smazat klub Bez klubové příslušnosti' }));

    // Právě tohle je pojistka proti osiřelým závodníkům: dokud není vybraný
    // cílový klub, smazat nejde.
    const potvrdit = screen.getByRole('button', { name: 'Smazat klub' });
    expect(potvrdit).toBeDisabled();
    expect(smazani()).toHaveLength(0);

    await user.selectOptions(screen.getByLabelText('Převést na klub'), '1');
    expect(potvrdit).toBeEnabled();
    await user.click(potvrdit);

    await waitFor(() => expect(smazani()).toHaveLength(1));
    expect(smazani()[0].cesta).toContain('/api/admin/clubs/3');
    expect(smazani()[0].cesta).toContain('reassign_to=1');
    expect(await screen.findByText(/přešli na klub SK Olešnice/)).toBeInTheDocument();
  });

  it('mazaný klub si sám sebe jako cíl nenabídne', async () => {
    const user = userEvent.setup();
    render(<ClubManagement />);
    await screen.findByText('Bez klubové příslušnosti');

    await user.click(screen.getByRole('button', { name: 'Smazat klub Bez klubové příslušnosti' }));

    const nabidka = screen.getByLabelText('Převést na klub');
    const popisky = Array.from(nabidka.options).map((o) => o.textContent);
    expect(popisky).not.toContain('Bez klubové příslušnosti');
    expect(popisky).toContain('SK Zaniklý (neplatný)');
  });

  it('zrušení dialogu klub nesmaže', async () => {
    const user = userEvent.setup();
    render(<ClubManagement />);
    await screen.findByText('SK Zaniklý');

    await user.click(screen.getByRole('button', { name: 'Smazat klub SK Zaniklý' }));
    await user.click(screen.getByRole('button', { name: 'Zrušit' }));

    expect(smazani()).toHaveLength(0);
    expect(screen.getByText('SK Zaniklý')).toBeInTheDocument();
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
