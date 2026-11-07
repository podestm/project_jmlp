import { describe, expect, it } from 'vitest';
import { candidatesForEvent, EMPTY_RESOLUTION, resolveInboxEvent } from './inboxMatching.js';

const entry = (id, bib, startNumber = id) => ({
  id,
  race_number_actual: bib,
  start_number: startNumber,
  racer_surname: `Z${id}`,
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
    expect(
      candidatesForEvent({ candidateEntryIds: [2] }, START_LIST, byId).map((e) => e.id),
    ).toEqual([2]);
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

describe('vyřazení ze startky', () => {
  // Dres 12 má závodník 2 (vyřazený) i závodník 3 z jiné sady; dres 14 jen vyřazený 4.
  const LIST = [
    entry(1, 11),
    { ...entry(2, 12), excluded: true },
    entry(3, 12, 5),
    { ...entry(4, 14), excluded: true },
  ];
  const listById = Object.fromEntries(LIST.map((e) => [e.id, e]));

  it('vyřazený není kandidátem, i když dres sedí', () => {
    expect(candidatesForEvent({ bib: 12 }, LIST, listById).map((e) => e.id)).toEqual([3]);
  });

  it('dřív uložený kandidát po vyřazení přestane platit', () => {
    // Impulz se spároval, než závodníka někdo vyřadil - ✓ mu teď nesmí zapsat čas.
    const event = { bib: 14, candidateEntryIds: [4], selectedEntryId: 4, status: 'pending' };

    const result = resolveInboxEvent(event, LIST, listById);

    expect(result.entry).toBeNull();
    expect(result.count).toBe(0);
  });

  it('dres jen vyřazeného řekne, že nikdo nezbyl kvůli vyřazení', () => {
    const result = resolveInboxEvent({ bib: 14 }, LIST, listById);

    expect(result.entry).toBeNull();
    expect(result.excluded).toBe(true);
  });

  it('úplně neznámý dres za vyřazení nevydává', () => {
    expect(resolveInboxEvent({ bib: 99 }, LIST, listById).excluded).toBe(false);
  });

  it('když dres má i někdo na startovce, vyřazení se nehlásí', () => {
    const result = resolveInboxEvent({ bib: 12 }, LIST, listById);

    expect(result.entry.id).toBe(3);
    expect(result.excluded).toBe(false);
  });

  it('bez dresu rozhodne ručně vybraný kandidát', () => {
    const result = resolveInboxEvent({ candidateEntryIds: [4] }, LIST, listById);

    expect(result.entry).toBeNull();
    expect(result.excluded).toBe(true);
  });

  it('zapsaná událost zůstává u svého závodníka i po jeho vyřazení', () => {
    const result = resolveInboxEvent(
      { bib: 14, selectedEntryId: 4, status: 'saved' },
      LIST,
      listById,
    );

    expect(result.entry.id).toBe(4);
    expect(result.excluded).toBe(false);
  });

  it('prázdný výsledek nese stejný tvar', () => {
    expect(EMPTY_RESOLUTION.excluded).toBe(false);
  });
});
