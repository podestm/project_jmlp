import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useMemo, useRef, useState } from 'react';
import { timekeeperDb } from '../../offline/db.js';
import { appendInboxEvent } from '../../offline/bridgeInbox.js';
import { resetTimekeeperDb, startListEntry } from '../../test/helpers.js';
import BridgeEventRow from './BridgeEventRow.jsx';
import SerialInboxPanel from './SerialInboxPanel.jsx';
import { AUTO_WRITE_KEY, useInboxEvents } from './useInboxEvents.js';

/**
 * Automatický zápis impulzů z časomíry.
 *
 * Jednoznačná událost do prázdného kola se zapíše sama, stejnou cestou jako ✓
 * (queueSave). Všechno ostatní - obsazené kolo, víc kandidátů, dres mimo
 * startovku, karta bez write locku, vypnutý přepínač - zůstává obsluze.
 */

beforeEach(resetTimekeeperDb);

const RACE_ID = '10';

/** Totéž zapojení jako v TimingEntry, jen bez obrazovky. */
const useHarness = ({ startList, queueSave, hasWriteLock = true, targetRound = '1', drafts = {} }) => {
  const [inboxEvents, setInboxEvents] = useState([]);
  const [message, setMessage] = useState(null);
  const [editedTimes, setEditedTimes] = useState(drafts);
  const startListById = useMemo(() => Object.fromEntries(startList.map((e) => [e.id, e])), [startList]);

  const startListRef = useRef(startList);
  const startListByIdRef = useRef(startListById);
  const inboxEventsRef = useRef([]);
  const selectedRaceIdRef = useRef(RACE_ID);
  const editedTimesRef = useRef(drafts);
  const hasWriteLockRef = useRef(hasWriteLock);
  const bridgeTargetRoundRef = useRef(targetRound);
  const tabIdRef = useRef('tab-test');

  useEffect(() => { editedTimesRef.current = editedTimes; }, [editedTimes]);
  useEffect(() => { startListRef.current = startList; }, [startList]);
  useEffect(() => { startListByIdRef.current = startListById; }, [startListById]);
  useEffect(() => { inboxEventsRef.current = inboxEvents; }, [inboxEvents]);
  useEffect(() => { hasWriteLockRef.current = hasWriteLock; }, [hasWriteLock]);

  const inbox = useInboxEvents({
    inboxEvents,
    setInboxEvents,
    startList,
    startListById,
    selectedRaceId: RACE_ID,
    queueSave,
    confirm: vi.fn(),
    setMessage,
    setEditedTimes,
    startListRef,
    startListByIdRef,
    inboxEventsRef,
    selectedRaceIdRef,
    editedTimesRef,
    hasWriteLockRef,
    bridgeTargetRoundRef,
    tabIdRef,
    sessionStartedAt: Date.now(),
    loading: false,
    readOnlyMessage: 'Jen pro čtení',
    hasWriteLock,
  });
  return { ...inbox, inboxEvents, message, editedTimes, editedTimesRef, startListByIdRef };
};

const savedOk = () => vi.fn(async () => ({ ok: true, queued: false, opId: null, queueId: null }));

const timeEvent = (overrides = {}) => ({ type: 'TIME', bib: 23, time: '01:02.34', seq: 1, raw: 'x', ...overrides });

/**
 * Automatický zápis bere jen impulzy, které přišly po jeho zapnutí v kartě.
 * Testy vkládají impulz před vykreslením hooku, proto ho "posunou" do budoucna,
 * jako by přišel až po zapnutí.
 */
const freshen = async () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await timekeeperDb.bridgeInbox.toCollection().modify({ created_at: future });
};

const storedRow = async () => (await timekeeperDb.bridgeInbox.toArray())[0];

/** Nech proběhnout párování na pozadí a případný automatický zápis. */
const settle = async (ms = 400) => {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
};

const racer = (overrides = {}) => startListEntry({ id: 1, race_number_actual: 23, ...overrides });

describe('automatický zápis z časomíry', () => {
  it('impulz, který přišel před zapnutím automatického zápisu, zůstává ruční', async () => {
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent());
    renderHook(() => useHarness({ startList: [racer()], queueSave }));

    await settle(600);
    expect(queueSave).not.toHaveBeenCalled();
    const row = await storedRow();
    expect(row.status).toBe('pending');
    expect(row.auto_written).toBeFalsy();
  });

  it('jednoznačnou událost do prázdného kola zapíše bez kliknutí', async () => {
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent());
    await freshen();
    renderHook(() => useHarness({ startList: [racer()], queueSave }));

    await waitFor(() => expect(queueSave).toHaveBeenCalledTimes(1));
    const [entryId, draft] = queueSave.mock.calls[0];
    expect(entryId).toBe(1);
    expect(draft).toMatchObject({ time1: '62.34', dnf: false, dns: false, dsq: false });

    await waitFor(async () => expect((await storedRow()).status).toBe('saved'));
    const row = await storedRow();
    expect(row.auto_written).toBe(true);
    expect(row.auto_previous).toMatchObject({ field: 'time1', value: '' });
    expect(row.race_id).toBe(10);
  });

  it('do obsazeného kola nezapíše a řádek nechá ruční s důvodem', async () => {
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent());
    await freshen();
    renderHook(() => useHarness({ startList: [racer({ time1: 70.5 })], queueSave }));

    await waitFor(async () => expect((await storedRow()).reason).toBe('round_occupied'));
    await settle();
    expect(queueSave).not.toHaveBeenCalled();
    expect((await storedRow()).status).toBe('pending');
  });

  it('kolo s DNF je obsazené, i když v něm není čas', async () => {
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent());
    await freshen();
    renderHook(() => useHarness({ startList: [racer({ dnf: true })], queueSave }));

    await waitFor(async () => expect((await storedRow()).reason).toBe('round_occupied'));
    expect(queueSave).not.toHaveBeenCalled();
  });

  it('rozepsaný neuložený čas se bere jako obsazené kolo', async () => {
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent());
    await freshen();
    const drafts = { 1: { time1: '55.10', time2: '', dnf: false, dns: false, dsq: false } };
    renderHook(() => useHarness({ startList: [racer()], queueSave, drafts }));

    await waitFor(async () => expect((await storedRow()).reason).toBe('round_occupied'));
    expect(queueSave).not.toHaveBeenCalled();
  });

  it('zapisuje do kola, které má událost; druhé kolo obsazené nevadí', async () => {
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent());
    await freshen();
    renderHook(() => useHarness({ startList: [racer({ time1: 70.5 })], queueSave, targetRound: '2' }));

    await waitFor(() => expect(queueSave).toHaveBeenCalledTimes(1));
    expect(queueSave.mock.calls[0][1]).toMatchObject({ time1: '70.5', time2: '62.34' });
  });

  it('víc kandidátů se stejným dresem zůstává ruční', async () => {
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent());
    await freshen();
    renderHook(() => useHarness({
      startList: [racer(), racer({ id: 2, start_number: 2 })],
      queueSave,
    }));

    await waitFor(async () => expect((await storedRow()).reason).toBe('multiple_matches'));
    await settle();
    expect(queueSave).not.toHaveBeenCalled();
    expect((await storedRow()).status).toBe('pending');
  });

  it('dres mimo startovku zůstává ruční', async () => {
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent({ bib: 99 }));
    await freshen();
    renderHook(() => useHarness({ startList: [racer()], queueSave }));

    await waitFor(async () => expect((await storedRow()).reason).toBe('bib_not_found'));
    await settle();
    expect(queueSave).not.toHaveBeenCalled();
  });

  it('vypnutý přepínač = chování jako dřív, nic se nezapíše samo', async () => {
    localStorage.setItem(AUTO_WRITE_KEY, '0');
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent());
    await freshen();
    const { result } = renderHook(() => useHarness({ startList: [racer()], queueSave }));

    await waitFor(async () => expect((await storedRow()).reason).toBe('ready'));
    await settle();
    expect(result.current.autoWrite).toBe(false);
    expect(queueSave).not.toHaveBeenCalled();
    expect((await storedRow()).status).toBe('pending');
  });

  it('přepínač je výchozí zapnutý a pamatuje si stav v zařízení', async () => {
    const { result } = renderHook(() => useHarness({ startList: [racer()], queueSave: savedOk() }));
    expect(result.current.autoWrite).toBe(true);

    act(() => result.current.setAutoWrite(false));

    expect(result.current.autoWrite).toBe(false);
    expect(localStorage.getItem(AUTO_WRITE_KEY)).toBe('0');
  });

  it('karta bez write locku nezapisuje', async () => {
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent());
    await freshen();
    renderHook(() => useHarness({ startList: [racer()], queueSave, hasWriteLock: false }));

    await waitFor(async () => expect((await storedRow()).reason).toBe('ready'));
    await settle();
    expect(queueSave).not.toHaveBeenCalled();
    expect((await storedRow()).status).toBe('pending');
  });

  it('DNF ze zařízení zapíše automaticky', async () => {
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent({ type: 'DNF', time: null }));
    await freshen();
    renderHook(() => useHarness({ startList: [racer()], queueSave }));

    await waitFor(() => expect(queueSave).toHaveBeenCalledTimes(1));
    expect(queueSave.mock.calls[0][1]).toMatchObject({ dnf: true, dns: false, dsq: false, time1: '' });
  });

  it('DNS ze zařízení zapíše automaticky', async () => {
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent({ type: 'DNS', time: null }));
    await freshen();
    renderHook(() => useHarness({ startList: [racer()], queueSave }));

    await waitFor(() => expect(queueSave).toHaveBeenCalledTimes(1));
    expect(queueSave.mock.calls[0][1]).toMatchObject({ dns: true, dnf: false, dsq: false });
  });

  it('DSQ zůstává ruční', async () => {
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent({ type: 'DSQ', time: null }));
    await freshen();
    renderHook(() => useHarness({ startList: [racer()], queueSave }));

    await waitFor(async () => expect((await storedRow()).reason).toBe('ready'));
    await settle();
    expect(queueSave).not.toHaveBeenCalled();
  });

  it('neplatný čas nezapíše a označí jako neplatný, stejně jako ruční ✓', async () => {
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent({ time: 'xx' }));
    await freshen();
    renderHook(() => useHarness({ startList: [racer()], queueSave }));

    await waitFor(async () => expect((await storedRow()).reason).toBe('invalid_time'));
    expect(queueSave).not.toHaveBeenCalled();
  });

  it('dva impulzy téhož dresu nezapíše oba - druhý najde kolo obsazené', async () => {
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent({ seq: 1 }));
    await appendInboxEvent(timeEvent({ seq: 2, time: '01:05.00' }));
    await freshen();
    renderHook(() => useHarness({ startList: [racer()], queueSave }));

    await waitFor(async () => {
      const rows = await timekeeperDb.bridgeInbox.orderBy('id').toArray();
      expect(rows[1].reason).toBe('round_occupied');
    });
    expect(queueSave).toHaveBeenCalledTimes(1);
    expect(queueSave.mock.calls[0][1].time1).toBe('62.34');
  });

  it('offline zápis jde do fronty stejně jako ruční potvrzení', async () => {
    const queueSave = vi.fn(async () => ({ ok: true, queued: true, opId: 'op-1', queueId: 7 }));
    await appendInboxEvent(timeEvent());
    await freshen();
    renderHook(() => useHarness({ startList: [racer()], queueSave }));

    await waitFor(async () => expect((await storedRow()).status).toBe('queued'));
    const row = await storedRow();
    expect(row.auto_written).toBe(true);
    expect(row.sync_op_id).toBe('op-1');
  });
});

describe('Zamítnout u automaticky zapsané události', () => {
  const autoWritten = async (harnessProps = {}) => {
    const queueSave = savedOk();
    await appendInboxEvent(timeEvent());
    await freshen();
    const hook = renderHook(() => useHarness({ startList: [racer()], queueSave, ...harnessProps }));
    await waitFor(async () => expect((await storedRow()).status).toBe('saved'));
    await waitFor(() => expect(hook.result.current.inboxEvents[0]?.status).toBe('saved'));
    return { ...hook, queueSave };
  };

  it('vrátí kolo na hodnotu před zápisem a událost označí jako zamítnutou', async () => {
    const { result, queueSave } = await autoWritten();
    const id = result.current.inboxEvents[0].id;

    await act(async () => { await result.current.rejectAutoWrittenEvent(id); });

    expect(queueSave).toHaveBeenCalledTimes(2);
    const [entryId, revert] = queueSave.mock.calls[1];
    expect(entryId).toBe(1);
    expect(revert).toMatchObject({ time1: '', dnf: false, dns: false, dsq: false });
    const row = await storedRow();
    expect(row.status).toBe('rejected');
    expect(row.reason).toBe('auto_rejected');
    // Kdo zamítl, se neukládá.
    expect(JSON.stringify(row)).not.toMatch(/rejected_by|user/);
  });

  it('když se kolo mezitím změnilo, nic nepřepíše a vysvětlí proč', async () => {
    const { result, queueSave } = await autoWritten();
    const id = result.current.inboxEvents[0].id;
    result.current.editedTimesRef.current = {
      ...result.current.editedTimesRef.current,
      1: { time1: '63.00', time2: '', dnf: false, dns: false, dsq: false },
    };

    await act(async () => { await result.current.rejectAutoWrittenEvent(id); });

    expect(queueSave).toHaveBeenCalledTimes(1);
    expect(result.current.message?.text).toMatch(/změnilo/);
    expect((await storedRow()).status).toBe('saved');
  });

  it('když se vrácení nepovede, událost zůstane zapsaná', async () => {
    const { result, queueSave } = await autoWritten();
    const id = result.current.inboxEvents[0].id;
    queueSave.mockResolvedValueOnce({ ok: false, queued: false });

    await act(async () => { await result.current.rejectAutoWrittenEvent(id); });

    expect((await storedRow()).status).toBe('saved');
  });
});

describe('řádek automaticky zapsané události', () => {
  const entry = racer({ racer_name: 'Anna', racer_surname: 'Holčičková' });
  const baseEvent = {
    id: 5,
    ts: Date.parse('2026-03-01T10:00:00Z'),
    bib: 23,
    time: '01:02.34',
    type: 'TIME',
    targetRound: '1',
  };
  const renderRow = (event, props = {}) => render(
    <BridgeEventRow
      event={event}
      resolvedEntry={entry}
      candidateCount={1}
      candidateIndex={0}
      fallbackTargetRound="1"
      onCycle={vi.fn()}
      onConfirm={vi.fn()}
      onReject={vi.fn()}
      onRejectAuto={vi.fn()}
      {...props}
    />
  );

  it('ukáže "Zapsáno automaticky" a jedinou akci Zamítnout', async () => {
    const onRejectAuto = vi.fn();
    renderRow({ ...baseEvent, status: 'saved', auto_written: true }, { onRejectAuto });

    expect(screen.getByText('Zapsáno automaticky')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '✓' })).toBeNull();
    expect(screen.queryByRole('button', { name: '✕' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Zamítnout' }));
    expect(onRejectAuto).toHaveBeenCalledWith(5);
  });

  it('zamítnutá ukáže jen "Zamítnuto", bez toho, kdo ji zamítl', () => {
    renderRow({ ...baseEvent, status: 'rejected', reason: 'auto_rejected', auto_written: true });

    expect(screen.getByText(/Zamítnuto/)).toBeInTheDocument();
    expect(screen.queryByText('Zapsáno automaticky')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Zamítnout' })).toBeNull();
    expect(screen.queryByText(/ručně/)).toBeNull();
  });

  it('obsazené kolo je vidět a ruční ✓ zůstává', () => {
    renderRow({ ...baseEvent, status: 'pending', reason: 'round_occupied' });

    expect(screen.getByText('Kolo obsazené')).toBeInTheDocument();
    expect(screen.getByText(/Kolo je obsazené/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '✓' })).toBeEnabled();
  });

  it('přepínač v inboxu volá změnu', async () => {
    const onAutoWriteChange = vi.fn();
    render(
      <SerialInboxPanel
        events={[]}
        visibleEvents={[]}
        hiddenCount={0}
        showAll={false}
        onShowAllChange={vi.fn()}
        resolutions={new Map()}
        targetRound="1"
        unparsedCount={0}
        resolvedCount={0}
        autoWrite
        onAutoWriteChange={onAutoWriteChange}
        onCycle={vi.fn()}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
        onDismissUnparsed={vi.fn()}
        onClearResolved={vi.fn()}
        onClearAll={vi.fn()}
      />
    );

    const toggle = screen.getByRole('switch', { name: 'Zapisovat automaticky' });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(onAutoWriteChange).toHaveBeenCalledWith(false);
  });
});
