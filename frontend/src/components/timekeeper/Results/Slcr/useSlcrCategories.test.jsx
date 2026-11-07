import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ getOnline: vi.fn(), postOnline: vi.fn() }));
vi.mock('../../../../config/timekeeperApi.js', () => ({ TimekeeperAPI: api }));

const { useSlcrCategories } = await import('./useSlcrCategories.js');

const DATA = {
  event: { id: 501, name: 'JMLP Hlubočky' },
  dry_run: false,
  categories: [
    {
      category_id: 1,
      name: 'Předžáci',
      total: 3,
      missing: 0,
      ready: true,
      slcr_race_id: 900,
      slcr_state: null,
    },
    {
      category_id: 2,
      name: 'Žáci',
      total: 2,
      missing: 0,
      ready: true,
      slcr_race_id: 901,
      slcr_state: 'Published',
    },
  ],
};

const confirm = vi.fn(async () => true);
const setup = (props = {}) =>
  renderHook((p) => useSlcrCategories({ raceId: '7', isOnline: true, confirm, ...p }), {
    initialProps: props,
  });

describe('useSlcrCategories', () => {
  beforeEach(() => {
    localStorage.clear();
    confirm.mockClear().mockResolvedValue(true);
    api.getOnline.mockReset().mockResolvedValue(DATA);
    api.postOnline.mockReset();
  });

  it('bez akce vybrané ráno nic nenačítá', () => {
    const { result } = setup();
    expect(result.current.eventId).toBe('');
    expect(api.getOnline).not.toHaveBeenCalled();
  });

  it('načte stav kategorií v akci uložené u závodu', async () => {
    localStorage.setItem('slcr_event_7', JSON.stringify({ eventId: 501, discipline: 18 }));
    const { result } = setup();
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(api.getOnline).toHaveBeenCalledWith('/api/timekeeper/races/7/slcr/categories', {
      event_id: '501',
    });
    expect(result.current.find(2).slcr_state).toBe('Published');
  });

  it('akci vybranou v dialogu převezme po zvýšení version', async () => {
    const { result, rerender } = setup({ version: 0 });
    localStorage.setItem('slcr_event_7', JSON.stringify({ eventId: 501, discipline: 26 }));
    rerender({ version: 1 });
    await waitFor(() => expect(result.current.eventId).toBe('501'));
  });

  it('offline nic nevolá', () => {
    localStorage.setItem('slcr_event_7', JSON.stringify({ eventId: 501, discipline: 18 }));
    setup({ isOnline: false });
    expect(api.getOnline).not.toHaveBeenCalled();
  });

  it('zveřejní kategorii po potvrzení a přepíše její stav', async () => {
    localStorage.setItem('slcr_event_7', JSON.stringify({ eventId: 501, discipline: 18 }));
    api.postOnline.mockResolvedValue({
      corrected: false,
      dry_run: false,
      category: {
        ...DATA.categories[0],
        slcr_state: 'Published',
        published_at: '2026-10-12T12:05:00+00:00',
      },
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    await act(() => result.current.publish(1, 'Předžáci'));

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Zveřejnit kategorii Předžáci v SLČR?' }),
    );
    expect(confirm.mock.calls[0][0].message).toContain('JMLP Hlubočky');
    expect(api.postOnline).toHaveBeenCalledWith(
      '/api/timekeeper/races/7/slcr/categories/1/publish',
      { event_id: 501, discipline: 18 },
    );
    expect(result.current.find(1).slcr_state).toBe('Published');
    expect(result.current.message).toMatchObject({ categoryId: '1', type: 'success' });
  });

  it('u zveřejněné se ptá na opravu; zrušené potvrzení nic neposílá', async () => {
    localStorage.setItem('slcr_event_7', JSON.stringify({ eventId: 501, discipline: 18 }));
    confirm.mockResolvedValue(false);
    const { result } = setup();
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    await act(() => result.current.publish(2, 'Žáci'));
    expect(confirm.mock.calls[0][0].confirmLabel).toBe('Opravit v SLČR');
    expect(api.postOnline).not.toHaveBeenCalled();
  });

  it('chybu z backendu ukáže u kategorie', async () => {
    localStorage.setItem('slcr_event_7', JSON.stringify({ eventId: 501, discipline: 18 }));
    api.postOnline.mockRejectedValue({
      detail: 'V kategorii Předžáci 1 závodník ještě nemá čas ani DNF/DNS/DSQ.',
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    await act(() => result.current.publish(1, 'Předžáci'));
    expect(result.current.message).toMatchObject({ categoryId: '1', type: 'danger' });
    expect(result.current.busyId).toBeNull();
  });
});
