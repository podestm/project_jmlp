import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
vi.mock('../../../config/api.js', () => ({ AdminAPI: mockApi }));

const { default: RacerManagement } = await import('./RacerManagement.jsx');

const RACERS = [
  {
    id: 1,
    firstName: 'Matyáš',
    lastName: 'Novák',
    sex: 1,
    birthYear: 2013,
    club_id: 5,
    category_id: 3,
    idSlcr: '204118',
    club_name: 'SKI KLUB JUNIOR BRNO',
    category_name: 'Starší žáci',
    slcr_url: 'https://evidence.czech-ski.com/clenove/7/novak-matyas',
  },
  {
    id: 2,
    firstName: 'Eliška',
    lastName: 'Nováková',
    sex: 2,
    birthYear: 2016,
    club_id: 6,
    category_id: 4,
    idSlcr: null,
    club_name: 'FreeSki Academy Brno',
    category_name: 'Předžačky',
  },
  {
    id: 3,
    firstName: 'Ondřej',
    lastName: 'Říha',
    sex: 1,
    birthYear: 2012,
    club_id: null,
    category_id: 3,
    idSlcr: null,
    club_name: null,
    category_name: null,
  },
];
const CLUBS = [
  { id: 5, name: 'SKI KLUB JUNIOR BRNO' },
  { id: 6, name: 'FreeSki Academy Brno' },
];
const CATEGORIES = [
  { id: 3, name: 'Starší žáci' },
  { id: 4, name: 'Předžačky' },
];

const respond = (racers = RACERS) => {
  mockApi.get.mockImplementation((url) =>
    Promise.resolve(
      url === '/api/admin/racers' ? racers : url === '/races/organizers' ? CLUBS : CATEGORIES,
    ),
  );
};

const renderScreen = () =>
  render(
    <MemoryRouter>
      <RacerManagement />
    </MemoryRouter>,
  );
const table = () => screen.findByRole('table', { name: 'Závodníci' });

describe('závodníci v administraci', () => {
  beforeEach(() => {
    Object.values(mockApi).forEach((fn) => fn.mockReset());
    respond();
  });

  it('načte závodníky a ukáže tabulku, propojené jméno vede na kartu SLČR', async () => {
    renderScreen();
    expect(screen.getByText('Načítám závodníky…')).toBeInTheDocument();
    const rows = within(await table()).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('Novák MatyášMuž2013Starší žáciSKI KLUB JUNIOR BRNO204118');
    expect(rows[3]).toHaveTextContent('Říha OndřejMuž2012Bez klubuUpravit');
    expect(within(rows[1]).getByRole('link', { name: 'Novák Matyáš' })).toHaveAttribute(
      'href',
      'https://evidence.czech-ski.com/clenove/7/novak-matyas',
    );
    expect(within(rows[3]).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/Zobrazeno/)).toHaveTextContent('Zobrazeno 3 z 3');
    expect(screen.queryByRole('button', { name: 'Zrušit filtry' })).not.toBeInTheDocument();
  });

  it('filtr klubu, pohlaví a hledání; prázdný výsledek jde zrušit', async () => {
    renderScreen();
    const t = await table();
    await userEvent.click(screen.getByRole('combobox', { name: 'Klub' }));
    await userEvent.click(screen.getByRole('option', { name: 'FreeSki Academy Brno' }));
    expect(within(t).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText(/Zobrazeno/)).toHaveTextContent('Zobrazeno 1 z 3');

    await userEvent.selectOptions(screen.getByLabelText('Pohlaví'), '1');
    expect(screen.getByText('Žádní závodníci neodpovídají filtru')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Zrušit filtry' })[0]);
    expect(within(await table()).getAllByRole('row')).toHaveLength(4);

    await userEvent.type(screen.getByLabelText('Hledat'), 'riha');
    await userEvent.clear(screen.getByLabelText('Hledat'));
    await userEvent.type(screen.getByLabelText('Hledat'), 'říha');
    await waitFor(() =>
      expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2),
    );
  });

  it('bez závodníků ukáže prázdný stav', async () => {
    respond([]);
    renderScreen();
    expect(await screen.findByText('Žádní závodníci nenalezeni')).toBeInTheDocument();
  });

  it('úprava otevře dialog s předvyplněnými údaji a uloží přes PUT', async () => {
    mockApi.put.mockResolvedValue({});
    renderScreen();
    await userEvent.click(
      within(await table()).getByRole('button', { name: 'Upravit závodníka Novák Matyáš' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Upravit závodníka' });
    expect(within(dialog).getByLabelText(/Jméno/)).toHaveValue('Matyáš');
    expect(within(dialog).getByLabelText('Klub')).toHaveValue('5');
    await userEvent.selectOptions(within(dialog).getByLabelText('Klub'), '');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Uložit změny' }));
    expect(mockApi.put).toHaveBeenCalledWith(
      '/api/admin/racers/1',
      expect.objectContaining({ firstName: 'Matyáš', club_id: null }),
    );
  });

  it('chyba uložení zůstane v dialogu a údaje se neztratí', async () => {
    mockApi.post.mockRejectedValue(new Error('Závodník Malá Viktorie už v registru je.'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderScreen();
    await table();
    await userEvent.click(screen.getByRole('button', { name: 'Nový závodník' }));
    const dialog = screen.getByRole('dialog', { name: 'Nový závodník' });
    await userEvent.type(within(dialog).getByLabelText(/Jméno/), 'Viktorie');
    await userEvent.type(within(dialog).getByLabelText(/Příjmení/), 'Malá');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vytvořit závodníka' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Závodník se neuložil.Závodník Malá Viktorie už v registru je.',
    );
    expect(within(dialog).getByLabelText(/Příjmení/)).toHaveValue('Malá');
  });

  it('smazání se ptá; Zrušit nic nesmaže, potvrzení zavolá DELETE', async () => {
    mockApi.delete.mockResolvedValue({});
    renderScreen();
    const t = await table();
    await userEvent.click(
      within(t).getByRole('button', { name: 'Smazat závodníka Nováková Eliška' }),
    );
    let dialog = screen.getByRole('dialog', { name: 'Smazat závodníka?' });
    expect(dialog).toHaveTextContent('2016 · Žena · FreeSki Academy Brno · Předžačky · bez SLČR');
    expect(within(dialog).getByRole('button', { name: 'Zrušit' })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Zrušit' }));
    expect(mockApi.delete).not.toHaveBeenCalled();

    await userEvent.click(
      within(t).getByRole('button', { name: 'Smazat závodníka Nováková Eliška' }),
    );
    dialog = screen.getByRole('dialog', { name: 'Smazat závodníka?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Smazat závodníka' }));
    expect(mockApi.delete).toHaveBeenCalledWith('/api/admin/racers/2');
  });
});
