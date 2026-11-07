import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({ getOnline: vi.fn(), postOnline: vi.fn() }));
vi.mock('../../../../../config/timekeeperApi.js', () => ({ TimekeeperAPI: api }));

const { default: SlcrDialog } = await import('./SlcrDialog.jsx');

const STATUS = { token: true, login: true, disciplines: [{ id: 26, name: 'Trénink' }] };
const PLAN = {
  event: { id: 501, name: 'JMLP Hlubočky', place: 'Hlubočky', date: '2027-01-09', category_mode: 'Manual', url: 'https://x/501' },
  items: [
    {
      category_id: 1, name: 'Předžáci', action: 'create',
      input: { codex: '1', startTime: '09:30:00', category: { manual: { sex: 'Male', yearFrom: 2016, yearTo: 2017 } } },
    },
    { category_id: 2, name: 'Žáci', action: 'keep', slcr_race_id: 9 },
  ],
};

const RACE = { race_nr: 'JMLP-03', datum: '2027-01-09' };

const mockGet = (status) => api.getOnline.mockReset().mockImplementation((url) => {
  if (url.endsWith('/slcr/status')) return Promise.resolve(status);
  if (url.endsWith('/slcr/events')) return Promise.resolve([{ id: 501, name: 'JMLP Hlubočky', date: '2027-01-09' }]);
  if (url.endsWith('/slcr/plan')) return Promise.resolve(PLAN);
  return Promise.reject(new Error(url));
});

describe('SlcrDialog', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGet(STATUS);
    api.postOnline.mockReset();
  });

  it('provede krokem 1 → náhled → založení', async () => {
    const user = userEvent.setup();
    render(<SlcrDialog race={RACE} raceId="7" hasResults onClose={() => {}} />);
    const select = await screen.findByRole('combobox', { name: 'Akce v evidenci' });
    expect(screen.getByRole('region', { name: 'Krok 1: Akce v evidenci' })).toHaveTextContent('Teď');
    expect(screen.getByRole('button', { name: 'Odeslat výsledky' })).toBeDisabled();
    expect(screen.getByText('Vyberte akci v kroku 1.')).toBeInTheDocument();

    await user.selectOptions(select, '501');
    await user.click(screen.getByRole('button', { name: 'Načíst náhled' }));

    const step2 = screen.getByRole('region', { name: 'Krok 2: Závody v akci' });
    expect(await within(step2).findByText('Předžáci')).toBeInTheDocument();
    expect(within(step2).getByText(/Disciplína Trénink · start 9:30 · založí se 1/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Otevřít v evidenci/ })).toHaveAttribute('href', 'https://x/501');
    expect(screen.getByText(/Nejdřív v kroku 2 založte/)).toBeInTheDocument();

    api.postOnline.mockResolvedValueOnce({
      event: PLAN.event, created: 1, codex_filled: 0,
      items: PLAN.items.map((item) => ({ ...item, action: 'keep' })),
    });
    await user.click(within(step2).getByRole('button', { name: 'Založit závody (1)' }));
    // Zápis do evidence se nejdřív potvrdí.
    await user.click(await screen.findByRole('button', { name: 'Založit závody' }));
    expect(await screen.findByText('Hotovo: založeno 1 závodů.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Odeslat výsledky' })).toBeEnabled();
  });

  it('bez nastavení na serveru vysvětlí, co chybí, a nic nepustí', async () => {
    mockGet({ token: false, login: false });
    render(<SlcrDialog race={RACE} raceId="7" hasResults onClose={() => {}} />);
    expect(await screen.findByText('SLČR není na serveru nastavené')).toBeInTheDocument();
    expect(screen.getByText(/SLCR_API_TOKEN/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Číslo akce' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Načíst náhled' })).toBeDisabled();
    expect(screen.getByText('Náhled zatím není')).toBeInTheDocument();
  });

  it('Zavřít zavře dialog', async () => {
    const onClose = vi.fn();
    render(<SlcrDialog race={RACE} raceId="7" hasResults onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Zavřít' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('zkušební režim hlásí trvale nahoře', async () => {
    mockGet({ ...STATUS, dry_run: true });
    render(<SlcrDialog race={RACE} raceId="7" hasResults onClose={() => {}} />);
    expect(await screen.findByText('Zkušební režim – do evidence SLČR se nic neposílá')).toBeInTheDocument();
  });
});
