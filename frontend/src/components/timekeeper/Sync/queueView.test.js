import { describe, expect, it } from 'vitest';
import { describeQueueItem, formatConflictField, isAuthExpired, localConflictEntry, queueStatus } from './queueView.js';

describe('synchronizace – fronta slovy', () => {
  it('popíše zápis času, Uložit vše a vyřazení', () => {
    expect(describeQueueItem({ method: 'PUT', endpoint: '/api/timekeeper/start-list/5/time', payload: { time1: '34.07', dnf: false } }))
      .toBe('Záznam #5: kolo 1 34.07');
    expect(describeQueueItem({ method: 'PUT', endpoint: '/api/timekeeper/start-list/5/time', payload: { dnf: true } }))
      .toBe('Záznam #5: DNF');
    expect(describeQueueItem({ method: 'POST', endpoint: '/api/timekeeper/races/3/times', payload: { entries: [{}, {}] } }))
      .toBe('Uložit vše – 2 záznamů');
    expect(describeQueueItem({ method: 'PUT', endpoint: '/api/timekeeper/start-list/2/excluded', payload: { excluded: true } }))
      .toBe('Záznam #2: vyřazení ze startovky');
    expect(describeQueueItem({ method: 'DELETE', endpoint: '/x' })).toBe('DELETE /x');
  });

  it('stav slovy i pro neznámý stav', () => {
    expect(queueStatus('dead').text).toBe('Neodesláno');
    expect(queueStatus('weird').text).toBe('weird');
  });

  it('konflikt: lokální záznam z Uložit vše a hodnoty', () => {
    const conflict = { payload: { entries: [{ entry_id: 1 }, { entry_id: 2, time1: 3 }] }, conflict_detail: { entry_id: 2 } };
    expect(localConflictEntry(conflict)).toEqual({ entry_id: 2, time1: 3 });
    expect(formatConflictField(false)).toBe('Ne');
    expect(formatConflictField(null)).toBe('—');
  });

  it('vypršelé přihlášení pozná z fronty', () => {
    expect(isAuthExpired([{ status: 'pending', last_error: 'Přihlášení vypršelo – …' }])).toBe(true);
    expect(isAuthExpired([{ status: 'dead', last_error: 'Přihlášení vypršelo' }])).toBe(false);
  });
});
