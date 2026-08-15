import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TimekeeperAPI } from './timekeeperApi.js';
import { timekeeperDb } from '../offline/db.js';
import { cacheGetResponse } from '../offline/startListCache.js';
import { resetTimekeeperDb, setOnline, startListEntry } from '../test/helpers.js';

// Cache se plní přes skutečnou zapisovací cestu, ne ručním řádkem: klíč nese
// i parametry dotazu (prázdné `{}` včetně), takže ručně psaný klíč by seděl
// jen náhodou.
const seedCache = (endpoint, data) => cacheGetResponse(endpoint, {}, data);

/**
 * Rozhodování klienta při zápisu: co jde rovnou na server, co do fronty a co
 * se smí zopakovat. Chyba tady znamená ztracený naměřený čas, takže se to
 * testuje na úrovni fetch, ne přes vnitřní funkce.
 */
const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: 'Test',
  json: async () => body
});

let fetchMock;

beforeEach(async () => {
  await resetTimekeeperDb();
  setOnline(true);
  localStorage.setItem('timekeeper_token', 'token-pro-test');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

describe('zápis online', () => {
  it('pošle požadavek rovnou a vrátí odpověď serveru', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ revision: 'r1' }));

    const result = await TimekeeperAPI.put('/api/timekeeper/start-list/1/time', { time1: 25.5 });

    expect(result).toEqual({ revision: 'r1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await timekeeperDb.syncQueue.count()).toBe(0);
  });

  it('ke každému zápisu přiloží klíč idempotence', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await TimekeeperAPI.put('/api/timekeeper/start-list/1/time', { time1: 1 });

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['X-Idempotency-Key']).toBeTruthy();
  });
});

describe('zápis offline', () => {
  it('uloží změnu do fronty a řekne to volajícímu', async () => {
    setOnline(false);

    const result = await TimekeeperAPI.put('/api/timekeeper/start-list/1/time', { time1: 25.5 });

    expect(result.queued).toBe(true);
    expect(result.op_id).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await timekeeperDb.syncQueue.count()).toBe(1);
  });

  it('čtení offline sáhne do cache', async () => {
    setOnline(false);
    await seedCache('/api/timekeeper/races', [{ id: 7 }]);

    expect(await TimekeeperAPI.get('/api/timekeeper/races')).toEqual([{ id: 7 }]);
  });

  it('čtení offline bez cache selže srozumitelně', async () => {
    setOnline(false);
    await expect(TimekeeperAPI.get('/api/timekeeper/races')).rejects.toThrow(/Offline/);
  });
});

describe('zápis při potížích serveru', () => {
  it('výpadek sítě uloží změnu do fronty místo ztráty', async () => {
    fetchMock.mockRejectedValue(new Error('Failed to fetch'));

    const result = await TimekeeperAPI.put('/api/timekeeper/start-list/1/time', { time1: 25.5 });

    expect(result.queued).toBe(true);
    expect(await timekeeperDb.syncQueue.count()).toBe(1);
  });

  it('chyba 5xx patří taky do fronty - zápis do databáze nedorazil', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'boom' }, 503));

    const result = await TimekeeperAPI.put('/api/timekeeper/start-list/1/time', { time1: 25.5 });

    expect(result.queued).toBe(true);
  });

  it('přehrávka nese stejný klíč idempotence jako neúspěšný pokus', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));

    const result = await TimekeeperAPI.put('/api/timekeeper/start-list/1/time', { time1: 1 });
    const queued = await timekeeperDb.syncQueue.toArray();

    // Kdyby se lišil, backend by po opožděném úspěchu zapsal čas dvakrát.
    expect(queued[0].op_id).toBe(result.op_id);
    expect(fetchMock.mock.calls[0][1].headers['X-Idempotency-Key']).toBe(result.op_id);
  });

  it('konflikt 409 do fronty NEPATŘÍ - server řekl ne schválně', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: { entry_id: 1 } }, 409));

    await expect(TimekeeperAPI.put('/api/timekeeper/start-list/1/time', { time1: 1 }))
      .rejects.toThrow(/409/);
    expect(await timekeeperDb.syncQueue.count()).toBe(0);
  });

  it('vypršené přihlášení se propíše volajícímu, ne do fronty', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'expired' }, 401));

    await expect(TimekeeperAPI.put('/api/timekeeper/start-list/1/time', { time1: 1 }))
      .rejects.toThrow(/401/);
    expect(await timekeeperDb.syncQueue.count()).toBe(0);
  });
});

describe('řazení zápisů za sebe', () => {
  it('zápis do řádku s čekající frontou jde taky do fronty, ne napřed', async () => {
    setOnline(false);
    await TimekeeperAPI.put('/api/timekeeper/start-list/1/time', { time1: 10 });

    setOnline(true);
    fetchMock.mockResolvedValue(jsonResponse({ revision: 'r' }));
    const result = await TimekeeperAPI.put('/api/timekeeper/start-list/1/time', { time1: 11 });

    // Poslaný rovnou by dorazil první a starší přehrávka by ho přepsala zpátky.
    expect(result.queued).toBe(true);
    expect(await timekeeperDb.syncQueue.count()).toBe(2);
  });

  it('zápis do jiného řádku frontou blokovaný není', async () => {
    setOnline(false);
    await TimekeeperAPI.put('/api/timekeeper/start-list/1/time', { time1: 10 });

    setOnline(true);
    fetchMock.mockResolvedValue(jsonResponse({ revision: 'r' }));
    const result = await TimekeeperAPI.put('/api/timekeeper/start-list/2/time', { time1: 11 });

    expect(result).toEqual({ revision: 'r' });
  });
});

describe('čtení online', () => {
  it('vrátí uložená data včetně dosud neodeslaných úprav', async () => {
    await timekeeperDb.startList.put(startListEntry({ time1: 25.5 }));
    setOnline(false);
    await TimekeeperAPI.put('/api/timekeeper/start-list/1/time', { time1: 25.5 });

    setOnline(true);
    fetchMock.mockResolvedValue(jsonResponse([startListEntry({ time1: null })]));

    const rows = await TimekeeperAPI.get('/api/timekeeper/races/10/start-list');

    expect(rows[0].time1).toBe(25.5);
  });

  it('při chybě serveru sáhne po cache', async () => {
    await seedCache('/api/timekeeper/races', [{ id: 7 }]);
    fetchMock.mockResolvedValue(jsonResponse({}, 500));

    expect(await TimekeeperAPI.get('/api/timekeeper/races')).toEqual([{ id: 7 }]);
  });

  it('vypršené přihlášení cache nemaskuje', async () => {
    await seedCache('/api/timekeeper/races', [{ id: 7 }]);
    fetchMock.mockResolvedValue(jsonResponse({}, 401));

    await expect(TimekeeperAPI.get('/api/timekeeper/races')).rejects.toThrow(/401/);
  });
});
