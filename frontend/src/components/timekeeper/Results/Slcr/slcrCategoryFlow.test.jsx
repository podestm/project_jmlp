import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useConfirm } from '../../../../hooks/useConfirm.jsx';

const api = vi.hoisted(() => ({ getOnline: vi.fn(), postOnline: vi.fn() }));
vi.mock('../../../../config/timekeeperApi.js', () => ({ TimekeeperAPI: api }));

const { useSlcrCategories } = await import('./useSlcrCategories.js');
const { default: SlcrCategoryPanel } = await import('./SlcrCategoryPanel/SlcrCategoryPanel.jsx');

const CATEGORY = { category_id: 4, category_name: 'Žačky', entries: [{ time_sum: 40.1 }, { time_sum: null, status: 'DSQ' }] };

/** Panel tak, jak ho skládá ResultsView: hook + potvrzovací dialog. */
function Harness() {
  const { confirm, confirmElement } = useConfirm();
  const slcr = useSlcrCategories({ raceId: '7', isOnline: true, confirm });
  return (
    <>
      <SlcrCategoryPanel category={CATEGORY} slcr={slcr} isOnline onOpenEvidence={() => {}} />
      {confirmElement}
    </>
  );
}

describe('výsledky kategorie do SLČR – celý postup', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('slcr_event_7', JSON.stringify({ eventId: 501, discipline: 19 }));
    api.getOnline.mockReset().mockResolvedValue({
      event: { id: 501, name: 'JMLP Hlubočky' },
      dry_run: true,
      categories: [{ category_id: 4, name: 'Žačky', total: 2, missing: 0, ready: true, slcr_race_id: 900, slcr_state: null }],
    });
    api.postOnline.mockReset().mockResolvedValue({
      corrected: false, dry_run: true,
      category: { category_id: 4, slcr_race_id: 900, slcr_state: 'Published', published_at: new Date(2026, 9, 12, 11, 30).toISOString() },
    });
  });

  it('potvrzení jmenuje kategorii i akci, po odeslání je kategorie zveřejněná', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText('Neodesláno');
    expect(screen.getByText('Zkušební režim – do evidence SLČR se nic neposílá')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Odeslat a zveřejnit v SLČR' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Zveřejnit kategorii Žačky v SLČR?')).toBeInTheDocument();
    expect(within(dialog).getByText(/„JMLP Hlubočky“/)).toBeInTheDocument();
    expect(api.postOnline).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Odeslat a zveřejnit' }));
    await waitFor(() => expect(screen.getByText('Zveřejněno v 11:30')).toBeInTheDocument());
    expect(api.postOnline).toHaveBeenCalledWith('/api/timekeeper/races/7/slcr/categories/4/publish', { event_id: 501, discipline: 19 });
    expect(screen.getByRole('button', { name: 'Opravit v SLČR' })).toBeInTheDocument();
    expect(screen.getByText(/Kategorie Žačky je v SLČR zveřejněná/)).toBeInTheDocument();
  });

  it('Zrušit v potvrzení nic neodešle', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText('Neodesláno');
    await user.click(screen.getByRole('button', { name: 'Odeslat a zveřejnit v SLČR' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Zrušit' }));
    expect(api.postOnline).not.toHaveBeenCalled();
    expect(screen.getByText('Neodesláno')).toBeInTheDocument();
  });
});
