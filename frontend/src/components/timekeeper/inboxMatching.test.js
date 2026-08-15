import { describe, expect, it } from 'vitest';
import { candidatesForEvent, resolveInboxEvent } from './inboxMatching.js';

const entry = (id, bib, startNumber = id) => ({
  id,
  race_number_actual: bib,
  start_number: startNumber,
  racer_surname: `Z${id}`
});

const START_LIST = [entry(1, 11), entry(2, 12), entry(3, 12, 5)];
const byId = Object.fromEntries(START_LIST.map((e) => [e.id, e]));

describe('candidatesForEvent', () => {
  it('najde závodníka podle čísla dresu', () => {
    expect(candidatesForEvent({ bib: 11 }, START_LIST, byId).map((e) => e.id)).toEqual([1]);
  });

  it('u dvou stejných dresů vrátí oba v pořadí startovních čísel', () => {
    // Závodník 2 má startovní číslo 2, závodník 3 má 5 - rozhoduje start, ne id.
    expect(candidatesForEvent({ bib: 12 }, START_LIST, byId).map((e) => e.id)).toEqual([2, 3]);
  });

  it('bez dresu použije jen dřív uložené kandidáty', () => {
    expect(candidatesForEvent({ candidateEntryIds: [2] }, START_LIST, byId).map((e) => e.id))
      .toEqual([2]);
    expect(candidatesForEvent({}, START_LIST, byId)).toEqual([]);
  });

  it('uložené kandidáty přepočítá, když už jim dres nesedí', () => {
    // Přečíslování sady dresů je běžné - držet se starých id by ukázalo
    // jiného závodníka, než komu čas patří.
    const event = { bib: 11, candidateEntryIds: [2] };
    expect(candidatesForEvent(event, START_LIST, byId).map((e) => e.id)).toEqual([1]);
  });

  it('neplatný dres nikoho nenajde', () => {
    expect(candidatesForEvent({ bib: 0 }, START_LIST, byId)).toEqual([]);
    expect(candidatesForEvent({ bib: 'abc' }, START_LIST, byId)).toEqual([]);
  });
});

describe('resolveInboxEvent', () => {
  it('vybere jediného kandidáta', () => {
    const result = resolveInboxEvent({ bib: 11 }, START_LIST, byId);
    expect(result.entry.id).toBe(1);
    expect(result.count).toBe(1);
    expect(result.index).toBe(0);
  });

  it('při více kandidátech nabídne prvního a řekne kolik jich je', () => {
    const result = resolveInboxEvent({ bib: 12 }, START_LIST, byId);
    expect(result.entry.id).toBe(2);
    expect(result.count).toBe(2);
  });

  it('respektuje ruční volbu obsluhy', () => {
    const result = resolveInboxEvent({ bib: 12, selectedEntryId: 3 }, START_LIST, byId);
    expect(result.entry.id).toBe(3);
    expect(result.index).toBe(1);
  });

  it('u už rozhodnuté události se závodník nepřepočítává', () => {
    // Zapsaný čas nesmí po přečíslování dresů skočit k jinému závodníkovi.
    const event = { bib: 99, selectedEntryId: 1, status: 'saved' };
    const result = resolveInboxEvent(event, START_LIST, byId);
    expect(result.entry.id).toBe(1);
    expect(result.count).toBe(1);
  });

  it('bez kandidátů vrací prázdný výsledek', () => {
    const result = resolveInboxEvent({ bib: 999 }, START_LIST, byId);
    expect(result.entry).toBeNull();
    expect(result.count).toBe(0);
    expect(result.index).toBe(-1);
  });
});
