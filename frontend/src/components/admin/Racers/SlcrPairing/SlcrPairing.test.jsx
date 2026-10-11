import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = { get: vi.fn(), post: vi.fn() };
vi.mock('../../../../config/api.js', () => ({ AdminAPI: mockApi }));

const { default: SlcrPairing } = await import('./SlcrPairing.jsx');

const SURE = {
  racer_id: 1,
  status: 'suggested',
  confidence: 'high',
  note: 'jméno a ročník z výsledků JMLP',
  racer: { surname: 'Černý', name: 'Lukáš', year: 2014, club: 'Ski klub VICTORIA Brno', slcr_id: null },
  slcr: { member_id: 9, surname: 'Černý', name: 'Lukáš', year: 2014, race_code: 205871, url: 'https://evidence.example/9' },
  changes: [{ field: 'slcr_id', label: 'ID závodníka', old: null, new: '205871' }],
  flags: {},
};
const UNSURE = {
  racer_id: 2,
  status: 'suggested',
  confidence: 'low',
  racer: { surname: 'Novák', name: 'Jakub', year: 2016, club: null, slcr_id: null },
  slcr: { member_id: 10, surname: 'Novák', name: 'Jakub', year: null, race_code: 207415, url: 'https://evidence.example/10' },
  alternatives: [{ member_id: 11, surname: 'Novák', name: 'Jakub', race_code: 203377, url: 'https://evidence.example/11' }],
  flags: { shared_member: true },
};
const SUMMARY = {
  running: false,
  counts: { suggested: 2, confirmed: 214, not_found: 96, rejected: 4, pending_apply: 12 },
  job: { finished_at: '2026-09-23T16:05:00', error: null },
};

const respond = ({ summary = SUMMARY, pairs = [SURE, UNSURE] } = {}) => {
  mockApi.get.mockImplementation((url) => Promise.resolve(url === '/api/admin/slcr/summary' ? summary : pairs));
};

const renderScreen = () => render(<MemoryRouter><SlcrPairing /></MemoryRouter>);
const table = () => screen.findByRole('table', { name: 'Párování se SLČR' });

describe('párování se SLČR v administraci', () => {
  beforeEach(() => {
    Object.values(mockApi).forEach((fn) => fn.mockReset());
    respond();
  });

  it('ukáže návrhy, počty v záložkách a cestu zpět na závodníky', async () => {
    renderScreen();
    expect(screen.getByText('Načítám párování…')).toBeInTheDocument();
    const rows = within(await table()).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('Černý Lukáš2014 · Ski klub VICTORIA Brno · ID —');
    expect(rows[1]).toHaveTextContent('Jistá shoda');
    expect(rows[1]).toHaveTextContent('Potvrzení u nás změní: ID závodníka – → 205871');
    expect(rows[2]).toHaveTextContent('Nejistá');
    expect(rows[2]).toHaveTextContent('Další kandidáti: Novák Jakub (203377)');
    expect(rows[2]).toHaveTextContent('Stejný člen i u jiného závodníka - duplicita?');
    expect(screen.getByRole('link', { name: 'Závodníci' })).toHaveAttribute('href', '/admin/racers');
    expect(screen.getByRole('button', { name: /K potvrzení/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Spárovaní/ })).toHaveTextContent('214');
    expect(screen.getByRole('button', { name: /Potvrdit jisté/ })).toHaveTextContent('Potvrdit jisté (1)');
    expect(screen.getByRole('button', { name: 'Převzít z evidence' }).closest('[role="status"]')).toHaveTextContent('U 12 potvrzených závodníků');
    expect(screen.getByText(/Naposledy načteno/)).toBeInTheDocument();
  });

  it('potvrzení řádku pošle rozhodnutí a řádek zmizí', async () => {
    mockApi.post.mockResolvedValue({});
    renderScreen();
    await userEvent.click(within(await table()).getByRole('button', { name: 'Potvrdit párování: Černý Lukáš' }));
    expect(mockApi.post).toHaveBeenCalledWith('/api/admin/slcr/pairs/1/confirm', {});
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2));
  });

  it('hledání a jistota filtrují; spárovaní mají jen Vrátit', async () => {
    renderScreen();
    await table();
    await userEvent.selectOptions(screen.getByLabelText('Jistota shody'), 'low');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    await userEvent.type(screen.getByLabelText('Hledat jméno nebo ID'), 'kovar');
    expect(screen.getByText('Nikdo neodpovídá hledání')).toBeInTheDocument();

    // Jistota platí dál i na jiných záložkách (kde výběr není) – vrátíme ji.
    await userEvent.selectOptions(screen.getByLabelText('Jistota shody'), 'all');
    respond({ pairs: [{ ...SURE, status: 'confirmed', applied: [{ label: 'jméno', old: 'Lukas' }] }] });
    await userEvent.click(screen.getByRole('button', { name: /Spárovaní/ }));
    await userEvent.clear(screen.getByLabelText('Hledat jméno nebo ID'));
    const t = await table();
    await waitFor(() => expect(within(t).getByRole('button', { name: 'Vrátit rozhodnutí: Černý Lukáš' })).toBeInTheDocument());
    expect(within(t).getByText('Převzato z evidence (jméno bylo Lukas)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Jistota shody')).not.toBeInTheDocument();
  });

  it('bez načtení prázdný stav s nápovědou; běžící načítání ukáže průběh', async () => {
    respond({ summary: { running: true, counts: {}, job: { done: 140, total: 325 } }, pairs: [] });
    renderScreen();
    expect(await screen.findByRole('progressbar', { name: 'Průběh načítání ze SLČR' })).toHaveAttribute('aria-valuenow', '140');
    expect(screen.getByText(/Načítám z evidence SLČR/)).toHaveTextContent('140 z 325 závodníků');
    expect(screen.getByLabelText('Koho načíst')).toBeDisabled();
    expect(await screen.findByText('Tady zatím nikdo není')).toBeInTheDocument();
  });

  it('chyba načtení se ukáže v hlášce', async () => {
    mockApi.get.mockImplementation((url) => (url === '/api/admin/slcr/summary'
      ? Promise.resolve({ running: false, counts: {}, job: null })
      : Promise.reject(new Error('Server neodpověděl'))));
    renderScreen();
    expect(await screen.findByRole('alert')).toHaveTextContent('Server neodpověděl');
    expect(screen.getByText('Začněte tlačítkem „Načíst návrhy ze SLČR“.')).toBeInTheDocument();
  });
});
