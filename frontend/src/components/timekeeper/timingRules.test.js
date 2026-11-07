import { describe, expect, it } from 'vitest';
import {
  buildTimeUpdate,
  calculateTimeSum,
  findRowInDirection,
  formatConflictValue,
  isSameDraft,
  mergeRestoredDrafts,
  normalizeDraft,
  parseStoredTime,
} from './timingRules.js';

describe('parseStoredTime', () => {
  it('přečte číslo z textu ve formuláři', () => {
    expect(parseStoredTime('25.5')).toBe(25.5);
    expect(parseStoredTime(25.5)).toBe(25.5);
  });

  it('prázdné a nesmyslné hodnoty jsou null, ne NaN', () => {
    expect(parseStoredTime('')).toBeNull();
    expect(parseStoredTime(null)).toBeNull();
    expect(parseStoredTime(undefined)).toBeNull();
    expect(parseStoredTime('abc')).toBeNull();
  });
});

describe('calculateTimeSum', () => {
  it('sečte jízdy zadané jako text', () => {
    expect(calculateTimeSum({ time1: '30.5', time2: '29.5' })).toBe(60);
  });

  it('jedna jízda stačí', () => {
    expect(calculateTimeSum({ time1: '30.5', time2: '' })).toBe(30.5);
  });

  it('příznak součet ruší', () => {
    expect(calculateTimeSum({ time1: '30', time2: '30', dnf: true })).toBeNull();
    expect(calculateTimeSum({ time1: '30', time2: '30', dsq: true })).toBeNull();
  });
});

describe('buildTimeUpdate', () => {
  it('prázdné pole pošle jako null, ne jako prázdný řetězec', () => {
    expect(buildTimeUpdate({ time1: '25.5', time2: '' })).toEqual({
      base_revision: null,
      force_apply: false,
      time1: 25.5,
      time2: null,
      dnf: false,
      dns: false,
      dsq: false,
    });
  });

  it('předá revizi i vynucení zápisu', () => {
    const update = buildTimeUpdate({
      time1: '1',
      time2: '',
      base_revision: 'r1',
      force_apply: true,
    });
    expect(update.base_revision).toBe('r1');
    expect(update.force_apply).toBe(true);
  });
});

describe('isSameDraft', () => {
  it('nerozlišuje text a číslo', () => {
    expect(isSameDraft({ time1: '25.50' }, { time1: 25.5 })).toBe(true);
  });

  it('prázdno a null jsou totéž', () => {
    expect(isSameDraft({ time1: '' }, { time1: null })).toBe(true);
  });

  it('jiná hodnota nebo příznak je rozdíl', () => {
    expect(isSameDraft({ time1: 25.5 }, { time1: 25.6 })).toBe(false);
    expect(isSameDraft({ time1: 25.5 }, { time1: 25.5, dnf: true })).toBe(false);
  });
});

describe('normalizeDraft', () => {
  it('doplní chybějící příznaky na false', () => {
    expect(normalizeDraft({ time1: '1' })).toEqual({
      time1: 1,
      time2: null,
      dnf: false,
      dns: false,
      dsq: false,
    });
  });
});

describe('mergeRestoredDrafts', () => {
  const entriesById = { 1: { id: 1 }, 2: { id: 2 } };

  it('vrátí rozepsaný čas do formuláře', () => {
    const serverTimes = { 1: { time1: '', time2: '', dnf: false, dns: false, dsq: false } };
    const drafts = { 1: { time1: 25.5, base: { time1: null, time2: null } } };

    const result = mergeRestoredDrafts(serverTimes, entriesById, drafts);

    expect(result.times[1].time1).toBe(25.5);
    expect(result.restored).toBe(1);
    expect(result.dropped).toBe(0);
  });

  it('zahodí koncept, když se řádek mezitím na serveru změnil', () => {
    // Jinak by starý rozepsaný čas přepsal novější výsledek z jiné karty.
    const serverTimes = { 1: { time1: '31.0', time2: '', dnf: false, dns: false, dsq: false } };
    const drafts = { 1: { time1: 25.5, base: { time1: null, time2: null } } };

    const result = mergeRestoredDrafts(serverTimes, entriesById, drafts);

    expect(result.times[1].time1).toBe('31.0');
    expect(result.dropped).toBe(1);
    expect(result.restored).toBe(0);
  });

  it('koncept shodný se serverem se nepočítá jako obnovený', () => {
    const serverTimes = { 1: { time1: '25.5', time2: '', dnf: false, dns: false, dsq: false } };
    const drafts = { 1: { time1: 25.5, base: { time1: 25.5, time2: null } } };

    expect(mergeRestoredDrafts(serverTimes, entriesById, drafts).restored).toBe(0);
  });

  it('koncept k řádku, který ve startovce není, se přeskočí', () => {
    const serverTimes = { 1: { time1: '', time2: '' } };
    const drafts = { 99: { time1: 10, base: {} } };

    const result = mergeRestoredDrafts(serverTimes, entriesById, drafts);
    expect(result.restored).toBe(0);
    expect(result.times[99]).toBeUndefined();
  });

  it('bez konceptů vrací serverová data beze změny', () => {
    const serverTimes = { 1: { time1: '10', time2: '' } };
    expect(mergeRestoredDrafts(serverTimes, entriesById, null).times).toEqual(serverTimes);
  });
});

describe('formatConflictValue', () => {
  it('prázdno je pomlčka, příznak je Ano/Ne', () => {
    expect(formatConflictValue(null)).toBe('—');
    expect(formatConflictValue('')).toBe('—');
    expect(formatConflictValue(true)).toBe('Ano');
    expect(formatConflictValue(false)).toBe('Ne');
    expect(formatConflictValue(25.5)).toBe('25.5');
  });
});

describe('findRowInDirection - šipky mezi řádky', () => {
  const list = [{ id: 1 }, { id: 2, locked: true }, { id: 3 }, { id: 4 }];
  const enabled = (row) => !row.locked;

  it('dolů i nahoru na sousední řádek, zamčený přeskočí', () => {
    expect(findRowInDirection(list, 0, 1, enabled)).toBe(2);
    expect(findRowInDirection(list, 2, -1, enabled)).toBe(0);
    expect(findRowInDirection(list, 2, 1, enabled)).toBe(3);
  });

  it('za okrajem seznamu nikam', () => {
    expect(findRowInDirection(list, 0, -1, enabled)).toBeNull();
    expect(findRowInDirection(list, 3, 1, enabled)).toBeNull();
  });
});

describe('nulový čas', () => {
  it('0, 0.0 i 0.00 je nezměřeno (null) - při čtení i v požadavku', () => {
    ['0', '0.0', '0.00', 0].forEach((value) => expect(parseStoredTime(value)).toBeNull());
    expect(buildTimeUpdate({ time1: '0.00', time2: '31.5' })).toMatchObject({
      time1: null,
      time2: 31.5,
    });
    expect(normalizeDraft({ time1: 0, time2: '' })).toMatchObject({ time1: null, time2: null });
  });
});
