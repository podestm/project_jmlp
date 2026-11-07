import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../../../config/api.js', () => ({ AdminAPI: { get: (...args) => mockGet(...args) } }));

const { default: RaceRegistrations } = await import('./RaceRegistrations.jsx');

const RACE = {
  id: 7, datum: '2026-10-03', race_nr: 'JMLP2026-01', areal_name: 'Brno – Kohoutovice',
  organizer_name: 'FreeSki Academy Brno', race_method_id: 2, registration: true,
};

const REGISTRATIONS = [
  { registration_id: 1, firstName: 'Matyáš', lastName: 'Novák', sex: 'M', birthYear: 2013, idSlcr: '204118', club_name: 'SKI KLUB JUNIOR BRNO', registration_date: '2026-09-23T14:02:00', category_id: 5, category_name: 'Starší žáci', category_order: 6 },
  { registration_id: 2, firstName: 'Eliška', lastName: 'Nováková', sex: 'Z', birthYear: 2016, idSlcr: null, club_name: 'SKI KLUB JUNIOR BRNO', registration_date: '2026-09-22T18:50:00', category_id: 2, category_name: 'Předžákyně', category_order: 1 },
  { registration_id: 3, firstName: 'Tereza', lastName: 'Dvořáková', sex: 'Z', birthYear: 2016, idSlcr: '205230', club_name: 'FreeSki Academy Brno', registration_date: '2026-09-22T19:15:00', category_id: 2, category_name: 'Předžákyně', category_order: 1 },
  { registration_id: 4, firstName: 'Viktorie', lastName: 'Malá', sex: 'Z', birthYear: 2015, idSlcr: null, club_name: 'Nový Klub', registration_date: null, category_id: null, category_name: null, category_order: null },
];

const respond = (registrations, race = RACE) => {
  mockGet.mockImplementation((url) => Promise.resolve(url.endsWith('/registrations') ? registrations : race));
};

const renderScreen = () => render(
  <MemoryRouter initialEntries={['/races/7/registrations']}>
    <Routes><Route path="/races/:raceId/registrations" element={<RaceRegistrations />} /></Routes>
  </MemoryRouter>,
);

describe('přihlášky k závodu', () => {
  beforeEach(() => {
    mockGet.mockReset();
    respond(REGISTRATIONS);
  });

  it('načte závod a přihlášky a ukáže kartu závodu s počty', async () => {
    renderScreen();
    expect(screen.getByText('Načítám přihlášky…')).toBeInTheDocument();
    expect(await screen.findByText('Brno – Kohoutovice, 3. 10. 2026')).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('/api/admin/races/7');
    expect(mockGet).toHaveBeenCalledWith('/api/admin/races/7/registrations');
    expect(screen.getByText('JMLP2026-01 · FreeSki Academy Brno · suchý slalom')).toBeInTheDocument();
    expect(screen.getByText('Registrace otevřená')).toBeInTheDocument();

    const tile = (label) => screen.getByText(label).nextElementSibling;
    expect(tile('Přihlášeno celkem')).toHaveTextContent('4');
    expect(tile('Klubů')).toHaveTextContent('3');
    expect(tile('Muži · ženy')).toHaveTextContent('1 · 3');
    expect(tile('Bez čísla SLČR')).toHaveTextContent('2');
    expect(screen.getByRole('link', { name: /1 závodník čeká na přiřazení klubu/ })).toHaveAttribute('href', '/admin/club-requests');
    expect(screen.getByRole('link', { name: 'Zpět na závody' })).toHaveAttribute('href', '/admin/races');
  });

  it('seskupí přihlášené podle klubu, řazení podle příjmení přidá sloupec Klub', async () => {
    renderScreen();
    const table = await screen.findByRole('table', { name: 'Přihlášení závodníci' });
    const groups = within(table).getAllByRole('columnheader', { name: /\d$/ }).map((th) => th.textContent);
    expect(groups).toEqual(['FreeSki Academy Brno1', 'SKI KLUB JUNIOR BRNO2', 'Čeká na přiřazení klubu1']);
    expect(within(table).getByText('Novák Matyáš')).toBeInTheDocument();
    expect(within(table).getByText('23. 9. 14:02')).toBeInTheDocument();
    expect(within(table).getByText('Čeká na klub')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Řazení'), 'name');
    expect(within(table).getByRole('columnheader', { name: 'Klub' })).toBeInTheDocument();
    const names = within(table).getAllByRole('strong').map((el) => el.textContent);
    expect(names).toEqual(['Dvořáková Tereza', 'Malá Viktorie', 'Novák Matyáš', 'Nováková Eliška']);
  });

  it('filtr hledá bez diakritiky, ukáže počet a jde zrušit', async () => {
    renderScreen();
    const table = await screen.findByRole('table', { name: 'Přihlášení závodníci' });
    await userEvent.type(screen.getByLabelText('Hledat závodníka'), 'novakova');
    expect(screen.getByText(/Zobrazeno/)).toHaveTextContent('Zobrazeno 1 z 4');
    expect(within(table).queryByText('Novák Matyáš')).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Hledat závodníka'));
    await userEvent.selectOptions(screen.getByLabelText('Klub'), 'Nový Klub');
    expect(within(table).getByText('Malá Viktorie')).toBeInTheDocument();
    expect(within(table).queryByText('Novák Matyáš')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Hledat závodníka'), 'xyz');
    expect(screen.getByText('Filtru nikdo neodpovídá')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Zrušit filtr' })[0]);
    expect(screen.queryByText(/Zobrazeno/)).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Přihlášení závodníci' })).toBeInTheDocument();
  });

  it('filtr kategorie v pořadí závodu, Bez kategorie na konci; sloupec Kategorie', async () => {
    renderScreen();
    const table = await screen.findByRole('table', { name: 'Přihlášení závodníci' });
    const headers = within(table).getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers.indexOf('Kategorie')).toBe(headers.indexOf('SLČR') - 1);
    expect(within(table).getByText('Starší žáci')).toBeInTheDocument();

    const select = screen.getByLabelText('Kategorie');
    expect(within(select).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Všechny kategorie', 'Předžákyně', 'Starší žáci', 'Bez kategorie']);

    await userEvent.selectOptions(select, 'none');
    expect(screen.getByText(/Zobrazeno/)).toHaveTextContent('Zobrazeno 1 z 4');
    expect(within(table).getByText('Malá Viktorie')).toBeInTheDocument();

    await userEvent.selectOptions(select, '2');
    await userEvent.selectOptions(screen.getByLabelText('Klub'), 'FreeSki Academy Brno');
    expect(screen.getByText(/Zobrazeno/)).toHaveTextContent('Zobrazeno 1 z 4');
    expect(within(table).getByText('Dvořáková Tereza')).toBeInTheDocument();
    expect(within(table).queryByText('Nováková Eliška')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zrušit filtr' }));
    expect(screen.getByLabelText('Kategorie')).toHaveValue('');
    expect(screen.getByLabelText('Klub')).toHaveValue('');
  });

  it('bez přihlášek ukáže prázdný stav', async () => {
    respond([], { ...RACE, registration: false });
    renderScreen();
    expect(await screen.findByText('Žádní registrovaní závodníci')).toBeInTheDocument();
    expect(screen.getByText('Registrace uzavřená')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('chyba načtení nevykreslí dlaždice ani seznam', async () => {
    mockGet.mockRejectedValue(new Error('Závod nenalezen'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderScreen();
    expect(await screen.findByRole('alert')).toHaveTextContent('Přihlášky se nepodařilo načíst.Závod nenalezen');
    expect(screen.queryByText('Přihlášeno celkem')).not.toBeInTheDocument();
    expect(screen.getByText('#7')).toBeInTheDocument();
  });
});
