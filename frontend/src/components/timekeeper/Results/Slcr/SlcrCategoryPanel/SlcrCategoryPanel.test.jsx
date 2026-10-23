import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SlcrCategoryPanel from './SlcrCategoryPanel.jsx';

const CATEGORY = {
  category_id: 1,
  category_name: 'Předžáci',
  entries: [{ time_sum: 41.2 }, { time_sum: null, status: 'DNF' }],
};

const slcrApi = (overrides = {}) => {
  const item = { category_id: 1, slcr_race_id: 900, slcr_state: null, ...overrides.item };
  return {
    eventId: '501',
    event: { id: 501, name: 'JMLP Hlubočky' },
    dryRun: false,
    loading: false,
    error: null,
    busyId: null,
    message: null,
    find: () => (overrides.item === null ? null : item),
    publish: vi.fn(),
    reload: vi.fn(),
    clearMessage: vi.fn(),
    ...overrides,
  };
};

const setup = (slcr, props = {}) => render(
  <SlcrCategoryPanel category={CATEGORY} slcr={slcr} isOnline onOpenEvidence={() => {}} {...props} />,
);

describe('SlcrCategoryPanel', () => {
  it('hotovou kategorii nabídne odeslat a zveřejnit', async () => {
    const slcr = slcrApi();
    setup(slcr);
    expect(screen.getByText('Neodesláno')).toBeInTheDocument();
    expect(screen.getByText(/Všichni mají čas/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Odeslat a zveřejnit v SLČR' }));
    expect(slcr.publish).toHaveBeenCalledWith('1', 'Předžáci');
  });

  it('závodníci bez času odeslání blokují a panel řekne kolik', () => {
    const category = { ...CATEGORY, entries: [...CATEGORY.entries, { time_sum: null }, { time_sum: null }, { time_sum: null }] };
    setup(slcrApi(), { category });
    expect(screen.getByText(/3 závodníci bez času/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Odeslat a zveřejnit v SLČR' })).toBeDisabled();
  });

  it('zveřejněnou kategorii nabízí opravit a ukáže čas', () => {
    const publishedAt = new Date(2026, 9, 12, 14, 5).toISOString();
    setup(slcrApi({ item: { slcr_state: 'Published', published_at: publishedAt } }));
    expect(screen.getByText('Zveřejněno v 14:05')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Opravit v SLČR' })).toBeEnabled();
  });

  it('bez vybrané akce pošle do Evidence SLČR', async () => {
    const onOpenEvidence = vi.fn();
    setup(slcrApi({ eventId: '' }), { onOpenEvidence });
    expect(screen.getByText(/Akce zatím není vybraná/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Evidence SLČR' }));
    expect(onOpenEvidence).toHaveBeenCalled();
  });

  it('kategorie bez závodu v akci a offline', () => {
    const { rerender } = setup(slcrApi({ item: { slcr_race_id: null } }));
    expect(screen.getByText(/nemá v akci svůj závod/)).toBeInTheDocument();
    rerender(<SlcrCategoryPanel category={CATEGORY} slcr={slcrApi()} isOnline={false} onOpenEvidence={() => {}} />);
    expect(screen.getByText(/vyžaduje připojení/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Odeslat a zveřejnit v SLČR' })).toBeDisabled();
  });

  it('zkušební režim je vidět vždy', () => {
    setup(slcrApi({ dryRun: true }));
    expect(screen.getByText('Zkušební režim – do evidence SLČR se nic neposílá')).toBeInTheDocument();
  });

  it('chyba načtení nabídne načíst znovu', async () => {
    const slcr = slcrApi({ error: 'Evidence SLČR neodpovídá', item: null });
    setup(slcr);
    expect(screen.getByText(/neodpovídá/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Načíst znovu' }));
    expect(slcr.reload).toHaveBeenCalled();
  });
});
