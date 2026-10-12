import { beforeEach, describe, expect, it } from 'vitest';
import {
  configProblems, createdMessage, formatSlcrDate, formatStartTime, planRow, planSummary, readSlcrChoice,
  sentMessage, slcrErrorText, storeSlcrChoice,
} from './slcr.js';

describe('slcr', () => {
  beforeEach(() => localStorage.clear());

  it('chyba bere detail z backendu', () => {
    expect(slcrErrorText({ detail: 'Akce neexistuje', message: 'API Error: 502' })).toBe('Akce neexistuje');
    expect(slcrErrorText(new Error('Vyžaduje připojení'))).toBe('Vyžaduje připojení');
    expect(slcrErrorText(null)).toBe('Neznámá chyba');
  });

  it('datum a čas startu česky', () => {
    expect(formatSlcrDate('2027-01-09')).toBe('9. 1. 2027');
    expect(formatSlcrDate('')).toBe('');
    expect(formatStartTime('09:30:00')).toBe('9:30');
    expect(formatStartTime(undefined)).toBe('');
  });

  it('řekne, co v nastavení chybí', () => {
    expect(configProblems(null)).toEqual([]);
    expect(configProblems({ token: true, login: true })).toEqual([]);
    expect(configProblems({ token: false, login: false })).toHaveLength(2);
    expect(configProblems({ token: true, login: false })[0]).toMatch(/SLCR_USERNAME/);
  });

  it('řádek náhledu u zakládaného závodu', () => {
    const row = planRow({
      category_id: 5, name: 'Žačky', action: 'create',
      input: { codex: '5', category: { manual: { sex: 'Female', yearFrom: 2012, yearTo: 2012 } } },
    });
    expect(row).toMatchObject({ codex: '5', sex: 'Ženy', years: '2012', action: 'create', slcrName: '' });
  });

  it('řádek náhledu u existujícího závodu s jiným názvem', () => {
    const row = planRow({ category_id: 6, name: 'Žáci', action: 'codex', slcr_name: 'Žáci U14' });
    expect(row).toMatchObject({ codex: '6', sex: '', years: '', slcrName: 'Žáci U14' });
  });

  it('souhrn náhledu', () => {
    const summary = planSummary({
      event: { category_mode: 'Manual' },
      items: [
        { action: 'create', input: { startTime: '10:00:00' } },
        { action: 'codex' },
        { action: 'keep' },
      ],
    });
    expect(summary).toEqual({ total: 3, toCreate: 1, toCodex: 1, changes: 2, manual: true, startTime: '10:00' });
    expect(planSummary(null)).toMatchObject({ total: 0, changes: 0, manual: false });
  });

  it('hlášky po založení a odeslání', () => {
    expect(createdMessage({ created: 3, codex_filled: 1 })).toBe('Hotovo: založeno 3 závodů, doplněn kodex u 1.');
    expect(createdMessage({ created: 0, codex_filled: 0 })).toBe('Všechny závody už v akci jsou.');
    expect(sentMessage({ unfinished: 2 })).toMatch(/2 startujících bez času/);
    expect(sentMessage({ unfinished: 0 })).not.toMatch(/startujících/);
  });

  it('pamatuje si akci a disciplínu pro každý závod zvlášť', () => {
    storeSlcrChoice(7, { eventId: '123', discipline: '18' });
    expect(readSlcrChoice(7)).toEqual({ eventId: 123, discipline: 18 });
    expect(readSlcrChoice(8)).toEqual({});
    localStorage.setItem('slcr_event_9', '{rozbité');
    expect(readSlcrChoice(9)).toEqual({});
  });
});
