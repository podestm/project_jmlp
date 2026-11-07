import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ getOnline: vi.fn(), postOnline: vi.fn() }));
vi.mock('../../../../config/timekeeperApi.js', () => ({ TimekeeperAPI: api }));

const { useSlcrEvidence } = await import('./useSlcrEvidence.js');

const STATUS = {
  token: true,
  login: true,
  disciplines: [
    { id: 26, name: 'Trénink' },
    { id: 18, name: 'Slalom' },
  ],
};
const EVENTS = [{ id: 501, name: 'JMLP Hlubočky', date: '2027-01-09' }];
const EVENT = { id: 501, name: 'JMLP Hlubočky', category_mode: 'Manual' };
const PLAN = {
  event: EVENT,
  items: [
    {
      category_id: 1,
      name: 'Předžáci',
      action: 'create',
      input: { codex: '1', startTime: '09:30:00' },
    },
    { category_id: 2, name: 'Žáci', action: 'keep', slcr_race_id: 9 },
  ],
};

const routeGet =
  (overrides = {}) =>
  (url) => {
    if (url.endsWith('/slcr/status')) return Promise.resolve(overrides.status ?? STATUS);
    if (url.endsWith('/slcr/events')) return overrides.events ?? Promise.resolve(EVENTS);
    if (url.endsWith('/slcr/plan')) return Promise.resolve(overrides.plan ?? PLAN);
    return Promise.reject(new Error(`neznámé ${url}`));
  };

const confirmYes = vi.fn(async () => true);
const setup = (props = {}) =>
  renderHook(() =>
    useSlcrEvidence({ raceId: '7', hasResults: true, confirm: confirmYes, ...props }),
  );

describe('useSlcrEvidence', () => {
  beforeEach(() => {
    localStorage.clear();
    api.getOnline.mockReset().mockImplementation(routeGet());
    api.postOnline.mockReset();
  });

  it('načte stav nastavení a akce kolem data závodu', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.events).toEqual(EVENTS));
    expect(result.current.configured).toBe(true);
    expect(result.current.step).toBe(1);
    expect(api.getOnline).toHaveBeenCalledWith('/api/timekeeper/races/7/slcr/events');
  });

  it('bez tokenu akce nenačítá a všechno je vypnuté', async () => {
    api.getOnline.mockImplementation(routeGet({ status: { token: false, login: false } }));
    const { result } = setup();
    await waitFor(() => expect(result.current.status).not.toBeNull());
    expect(result.current.problems).toHaveLength(2);
    act(() => result.current.setEventId('501'));
    expect(result.current.canPreview).toBe(false);
    expect(result.current.canSend).toBe(false);
    expect(api.getOnline).toHaveBeenCalledTimes(1);
  });

  it('náhled si zapamatuje akci a vede na krok 2', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.configured).toBe(true));
    act(() => result.current.setEventId('#501'));
    expect(result.current.eventId).toBe('501');
    await act(() => result.current.loadPlan());
    expect(api.getOnline).toHaveBeenCalledWith('/api/timekeeper/races/7/slcr/plan', {
      event_id: '501',
      discipline: 26,
    });
    expect(result.current.step).toBe(2);
    expect(result.current.canCreate).toBe(true);
    // Chybí závody → výsledky ještě nejdou poslat.
    expect(result.current.canSend).toBe(false);
    expect(JSON.parse(localStorage.getItem('slcr_event_7'))).toEqual({
      eventId: 501,
      discipline: 26,
    });
  });

  it('změna disciplíny zahodí náhled', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.configured).toBe(true));
    act(() => result.current.setEventId('501'));
    await act(() => result.current.loadPlan());
    act(() => result.current.setDiscipline('18'));
    expect(result.current.plan).toBeNull();
    expect(result.current.discipline).toBe(18);
  });

  it('založí závody a pak pustí odeslání výsledků', async () => {
    api.postOnline.mockResolvedValueOnce({
      event: EVENT,
      created: 1,
      codex_filled: 0,
      items: PLAN.items.map((item) => ({ ...item, action: 'keep' })),
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.configured).toBe(true));
    act(() => result.current.setEventId('501'));
    await act(() => result.current.loadPlan());
    await act(() => result.current.createRaces());
    expect(api.postOnline).toHaveBeenCalledWith('/api/timekeeper/races/7/slcr/races', {
      event_id: 501,
      discipline: 26,
    });
    expect(result.current.message).toEqual({ type: 'success', text: 'Hotovo: založeno 1 závodů.' });
    expect(result.current.step).toBe(3);
    expect(result.current.canSend).toBe(true);

    api.postOnline.mockResolvedValueOnce({ unfinished: 0 });
    await act(() => result.current.sendResults());
    expect(api.postOnline).toHaveBeenLastCalledWith('/api/timekeeper/races/7/slcr/results', {
      event_id: 501,
      discipline: 26,
    });
    expect(result.current.sent).toBe(true);
  });

  it('výsledky jdou poslat i bez náhledu do akce zapamatované ráno', async () => {
    localStorage.setItem('slcr_event_7', JSON.stringify({ eventId: 501, discipline: 18 }));
    const { result } = setup();
    await waitFor(() => expect(result.current.configured).toBe(true));
    expect(result.current.eventId).toBe('501');
    expect(result.current.discipline).toBe(18);
    expect(result.current.canSend).toBe(true);
  });

  it('bez výsledků nejde odeslat', async () => {
    const { result } = setup({ hasResults: false });
    await waitFor(() => expect(result.current.configured).toBe(true));
    act(() => result.current.setEventId('501'));
    expect(result.current.canSend).toBe(false);
  });

  it('chybu z evidence ukáže textem z backendu a náhled zahodí', async () => {
    api.getOnline.mockImplementation((url) =>
      url.endsWith('/slcr/plan')
        ? Promise.reject(
            Object.assign(new Error('API Error: 502'), { detail: 'Evidence neodpovídá' }),
          )
        : routeGet()(url),
    );
    const { result } = setup();
    await waitFor(() => expect(result.current.configured).toBe(true));
    act(() => result.current.setEventId('501'));
    await act(() => result.current.loadPlan());
    expect(result.current.plan).toBeNull();
    expect(result.current.message).toEqual({ type: 'danger', text: 'Evidence neodpovídá' });
    expect(result.current.busy).toBeNull();
  });

  it('chyba při načtení akcí zůstane u výběru akce', async () => {
    api.getOnline.mockImplementation(
      routeGet({
        events: Promise.reject(Object.assign(new Error('x'), { detail: 'Neplatný token' })),
      }),
    );
    const { result } = setup();
    await waitFor(() => expect(result.current.eventsError).toBe('Neplatný token'));
  });

  it('bez potvrzení nic nezaloží ani neodešle', async () => {
    const confirmNo = vi.fn(async () => false);
    const { result } = setup({ confirm: confirmNo });
    await waitFor(() => expect(result.current.configured).toBe(true));
    act(() => result.current.setEventId('501'));
    await act(() => result.current.loadPlan());
    api.postOnline.mockClear();
    await act(() => result.current.createRaces());
    await act(() => result.current.sendResults());
    expect(confirmNo).toHaveBeenCalledTimes(2);
    expect(confirmNo.mock.calls[0][0].title).toBe('Založit závody v evidenci SLČR?');
    expect(confirmNo.mock.calls[1][0].title).toBe('Odeslat výsledky do evidence SLČR?');
    expect(api.postOnline).not.toHaveBeenCalled();
  });
});
