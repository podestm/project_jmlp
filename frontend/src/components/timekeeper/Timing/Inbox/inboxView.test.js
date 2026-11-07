import { describe, expect, it } from 'vitest';
import { autoWriteSummary, eventDestination, eventStatus, groupInboxEvents } from './inboxView.js';

describe('schránka impulzů – stav slovy', () => {
  it('zapsané automaticky, ručně, zamítnuté a neuložené', () => {
    expect(eventStatus({ status: 'saved', auto_written: true }).text).toBe('Zapsáno automaticky');
    expect(eventStatus({ status: 'queued' }).text).toBe('Potvrzeno ručně');
    expect(eventStatus({ status: 'rejected', reason: 'auto_rejected' }).text).toBe('Zamítnuto');
    expect(eventStatus({ status: 'save_failed' })).toEqual({ tone: 'danger', text: 'Neuloženo' });
    expect(eventStatus({ status: 'warning', reason: 'unparsed' }).text).toBe('Nerozpoznáno');
  });

  it('čekající: obsazené kolo, víc shod, nebo prosté čekání', () => {
    expect(eventStatus({ status: 'pending', reason: 'round_occupied' }).text).toBe('Kolo obsazené');
    expect(eventStatus({ status: 'pending' }, { candidateCount: 2, candidateIndex: 1 }).text).toBe(
      '2 shody · 2/2',
    );
    expect(eventStatus({ status: 'pending' }).text).toBe('Čeká na potvrzení');
  });

  it('kam zápis došel', () => {
    expect(eventDestination({ status: 'queued' })).toBe('ve frontě');
    expect(eventDestination({ status: 'saved', sync_op_id: 'x' })).toBe('ve frontě');
    expect(eventDestination({ status: 'saved' })).toBe('ve výsledcích');
    expect(eventDestination({ status: 'pending' })).toBeNull();
  });
});

describe('schránka impulzů – skupiny a souhrn', () => {
  const events = [
    { id: 1, status: 'saved', auto_written: true },
    { id: 2, status: 'pending' },
    { id: 3, status: 'rejected', reason: 'auto_rejected', auto_written: true },
    { id: 4, status: 'save_failed' },
    { id: 5, status: 'queued', auto_written: true },
  ];

  it('výjimky nahoru, zapsané a vyřízené dolů, pořadí zůstává', () => {
    const { decide, done } = groupInboxEvents(events);
    expect(decide.map((e) => e.id)).toEqual([2, 4]);
    expect(done.map((e) => e.id)).toEqual([1, 3, 5]);
  });

  it('souhrn automatického zápisu', () => {
    expect(autoWriteSummary(events)).toEqual({ autoWritten: 2, toDecide: 2, rejected: 1 });
  });
});
