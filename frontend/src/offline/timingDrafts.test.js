import { beforeEach, describe, expect, it } from 'vitest';
import { timekeeperDb } from './db.js';
import { clearTimingDrafts, loadTimingDrafts, saveTimingDrafts } from './timingDrafts.js';
import { resetTimekeeperDb } from '../test/helpers.js';

const draft = {
  1: {
    time1: '25.5',
    time2: '',
    dnf: false,
    dns: false,
    dsq: false,
    base: { time1: null, time2: null },
  },
};

beforeEach(resetTimekeeperDb);

describe('rozepsané časy', () => {
  it('přežijí obnovení stránky', async () => {
    await saveTimingDrafts(10, draft);
    expect(await loadTimingDrafts(10)).toEqual(draft);
  });

  it('drží se každý závod zvlášť', async () => {
    await saveTimingDrafts(10, draft);
    expect(await loadTimingDrafts(11)).toEqual({});
  });

  it('prázdná sada řádek smaže, ať se nehromadí', async () => {
    await saveTimingDrafts(10, draft);
    await saveTimingDrafts(10, {});

    expect(await loadTimingDrafts(10)).toEqual({});
    expect(await timekeeperDb.settings.get('timing_drafts_10')).toBeUndefined();
  });

  it('smazání funguje i pro závod bez konceptů', async () => {
    await expect(clearTimingDrafts(99)).resolves.toBeUndefined();
  });

  it('pro dosud neuložený závod vrací prázdno, ne chybu', async () => {
    expect(await loadTimingDrafts(123)).toEqual({});
  });

  it('poškozený obsah nepovažuje za koncepty', async () => {
    await timekeeperDb.settings.put({ key: 'timing_drafts_10', value: 'nesmysl', updated_at: 'x' });
    expect(await loadTimingDrafts(10)).toEqual({});
  });

  it('uloží i výchozí hodnoty ze serveru, proti kterým se psalo', async () => {
    // `base` je to, co po obnovení rozhodne, jestli si koncept ponechat -
    // proto se musí uložit celý, ne jen napsaný čas.
    await saveTimingDrafts(10, draft);
    const loaded = await loadTimingDrafts(10);
    expect(loaded[1].base).toEqual({ time1: null, time2: null });
  });
});
