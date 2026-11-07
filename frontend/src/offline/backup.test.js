import { beforeEach, describe, expect, it } from 'vitest';
import { timekeeperDb } from './db.js';
import { createBackupSnapshot, importBackupPayload } from './backup.js';
import { resetTimekeeperDb, startListEntry } from '../test/helpers.js';

/**
 * Záloha tabletu časoměřiče.
 *
 * Testuje se hlavně import, protože ten může data ZTRATIT: cizí záloha nese
 * vlastní autoincrement id a slepý zápis by přepsal lokální řádky fronty,
 * tedy dosud neodeslané naměřené časy.
 */
const queueRow = (overrides = {}) => ({
  op_id: 'op-1',
  status: 'pending',
  retry_count: 0,
  created_at: '2026-01-01T10:00:00.000Z',
  updated_at: '2026-01-01T10:00:00.000Z',
  method: 'PUT',
  endpoint: '/api/timekeeper/start-list/1/time',
  payload: { time1: 10 },
  ...overrides,
});

const inboxRow = (overrides = {}) => ({
  race_id: 10,
  status: 'pending',
  created_at: '2026-01-01T10:00:00.000Z',
  op_key: 'impulz-1',
  bib: 11,
  ...overrides,
});

const payloadOf = (snapshot) => JSON.stringify(snapshot);

beforeEach(resetTimekeeperDb);

describe('createBackupSnapshot', () => {
  it('zálohuje i schránku impulzů z časomíry', async () => {
    await timekeeperDb.bridgeInbox.add(inboxRow());
    await timekeeperDb.syncQueue.add(queueRow());

    const snapshot = await createBackupSnapshot();

    // Bez bridgeInboxu by záloha vynechala právě ta data, která existují
    // jen na tabletu.
    expect(snapshot.data.bridgeInbox).toHaveLength(1);
    expect(snapshot.data.syncQueue).toHaveLength(1);
  });

  it('nese razítko a verzi, ať jde poznat, odkud záloha je', async () => {
    const snapshot = await createBackupSnapshot();
    expect(snapshot.meta.exported_at).toBeTruthy();
    expect(snapshot.meta.version).toBeTruthy();
  });
});

describe('importBackupPayload', () => {
  it('naimportuje řádky do prázdné databáze', async () => {
    const snapshot = await createBackupSnapshot();
    snapshot.data.syncQueue = [queueRow({ id: 1 })];
    snapshot.data.startList = [startListEntry()];

    const result = await importBackupPayload(payloadOf(snapshot));

    expect(result.tableCounts.syncQueue).toBe(1);
    expect(await timekeeperDb.syncQueue.count()).toBe(1);
  });

  /**
   * Jádro věci: cizí tablet má vlastní číslování. Kdyby se řádky zapsaly pod
   * původními id, přepsaly by lokální frontu - tedy časy, které ještě nikam
   * neodešly.
   */
  it('nepřepíše lokální frontu řádkem z cizí zálohy se stejným id', async () => {
    const localId = await timekeeperDb.syncQueue.add(
      queueRow({ op_id: 'muj-zapis', payload: { time1: 99 } }),
    );

    const snapshot = await createBackupSnapshot();
    snapshot.data.syncQueue = [
      queueRow({ id: localId, op_id: 'cizi-zapis', payload: { time1: 11 } }),
    ];

    await importBackupPayload(payloadOf(snapshot));

    const mine = await timekeeperDb.syncQueue.get(localId);
    expect(mine.op_id).toBe('muj-zapis');
    expect(mine.payload.time1).toBe(99);
    expect(await timekeeperDb.syncQueue.count()).toBe(2);
  });

  it('opakovaný import téže zálohy impulzy nezduplikuje', async () => {
    const snapshot = await createBackupSnapshot();
    snapshot.data.bridgeInbox = [inboxRow({ id: 1, op_key: 'impulz-A' })];

    await importBackupPayload(payloadOf(snapshot));
    const druhy = await importBackupPayload(payloadOf(snapshot));

    expect(await timekeeperDb.bridgeInbox.count()).toBe(1);
    expect(druhy.skippedCounts.bridgeInbox).toBe(1);
    expect(druhy.skippedTotal).toBeGreaterThan(0);
  });

  it('duplicitu pozná i uvnitř jedné zálohy', async () => {
    const snapshot = await createBackupSnapshot();
    snapshot.data.bridgeInbox = [
      inboxRow({ id: 1, op_key: 'impulz-A' }),
      inboxRow({ id: 2, op_key: 'impulz-A' }),
    ];

    await importBackupPayload(payloadOf(snapshot));

    expect(await timekeeperDb.bridgeInbox.count()).toBe(1);
  });

  it('přemapuje odkaz impulzu na nové id položky fronty', async () => {
    const snapshot = await createBackupSnapshot();
    snapshot.data.syncQueue = [queueRow({ id: 77, op_id: 'op-77' })];
    snapshot.data.bridgeInbox = [inboxRow({ id: 5, op_key: 'impulz-B', sync_queue_id: 77 })];

    await importBackupPayload(payloadOf(snapshot));

    const queue = await timekeeperDb.syncQueue.toArray();
    const inbox = await timekeeperDb.bridgeInbox.toArray();
    // Odkaz musí mířit na skutečně vzniklý řádek, ne na číslo z cizího tabletu.
    expect(inbox[0].sync_queue_id).toBe(queue[0].id);
    expect(inbox[0].sync_queue_id).not.toBe(77);
  });

  it('u přeskočené položky ukáže odkaz na ten řádek, který tu už je', async () => {
    const snapshot = await createBackupSnapshot();
    snapshot.data.syncQueue = [queueRow({ id: 77, op_id: 'sdilena-operace' })];
    snapshot.data.bridgeInbox = [inboxRow({ id: 5, op_key: 'impulz-C', sync_queue_id: 77 })];

    await importBackupPayload(payloadOf(snapshot));
    snapshot.data.bridgeInbox = [inboxRow({ id: 6, op_key: 'impulz-D', sync_queue_id: 77 })];
    await importBackupPayload(payloadOf(snapshot));

    const queue = await timekeeperDb.syncQueue.toArray();
    const posledni = (await timekeeperDb.bridgeInbox.toArray()).find(
      (r) => r.op_key === 'impulz-D',
    );
    expect(queue).toHaveLength(1);
    expect(posledni.sync_queue_id).toBe(queue[0].id);
  });

  it('poškozený soubor odmítne srozumitelně', async () => {
    await expect(importBackupPayload('{nevalidní json')).rejects.toThrow();
  });
});
