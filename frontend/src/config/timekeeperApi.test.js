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

/**
 * Nevratné mazání (startovka, naměřené výsledky) se od ostatních zápisů liší:
 * odložit ho na později znamená smazat i to, co mezitím vzniklo. Proto nikdy
 * nesmí skončit ve frontě - ani při výpadku, ani při 5xx.
 */
describe('mazání, které se nesmí odložit', () => {
  it('online pošle požadavek rovnou i s klíčem idempotence', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Smazáno' }));

    const result = await TimekeeperAPI.deleteOnline('/api/timekeeper/races/1/results');

    expect(result).toEqual({ message: 'Smazáno' });
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    expect(fetchMock.mock.calls[0][1].headers['X-Idempotency-Key']).toBeTruthy();
    expect(await timekeeperDb.syncQueue.count()).toBe(0);
  });

  it('offline se ani nepokusí odeslat a chybu řekne volajícímu', async () => {
    setOnline(false);

    await expect(TimekeeperAPI.deleteOnline('/api/timekeeper/races/1/results'))
      .rejects.toThrow(/připojení/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await timekeeperDb.syncQueue.count()).toBe(0);
  });

  it('výpadek sítě uprostřed požadavku do fronty nespadne', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(TimekeeperAPI.deleteOnline('/api/timekeeper/races/1/results')).rejects.toThrow();
    expect(await timekeeperDb.syncQueue.count()).toBe(0);
  });

  it('chyba 5xx se nevydává za "uloženo lokálně"', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Server error' }, 500));

    await expect(TimekeeperAPI.deleteOnline('/api/timekeeper/races/1/start-list')).rejects.toThrow();
    expect(await timekeeperDb.syncQueue.count()).toBe(0);
  });
});

/**
 * Kluby do formuláře závodníka (TimekeeperRacers) jsou veřejný endpoint, ale
 * časoměřič je musí mít i offline. Dřív je držela jen keš service workeru,
 * který data už nekešuje (public/sw.js) - teď jdou do IndexedDB jako zbytek
 * obrazovky.
 */
describe('kluby pro časoměřiče', () => {
  const KLUBY = [{ id: 1, name: 'SK Olešnice' }, { id: 2, name: 'Ski Klub Brno' }];

  it('kluby načtené online jsou k dispozici i offline', async () => {
    fetchMock.mockResolvedValue(jsonResponse(KLUBY));
    await TimekeeperAPI.get('/clubs/');

    setOnline(false);
    fetchMock.mockClear();

    expect(await TimekeeperAPI.get('/clubs/')).toEqual(KLUBY);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('když prohlížeč hlásí připojení, ale síť nejede, vrátí kluby z cache', async () => {
    // Captive portal na závodišti: navigator.onLine lže
    fetchMock.mockResolvedValueOnce(jsonResponse(KLUBY));
    await TimekeeperAPI.get('/clubs/');

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await TimekeeperAPI.get('/clubs/')).toEqual(KLUBY);
  });

  it('čerstvá data ze serveru cache přepíší', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(KLUBY));
    await TimekeeperAPI.get('/clubs/');
    fetchMock.mockResolvedValueOnce(jsonResponse([...KLUBY, { id: 3, name: 'Nový klub' }]));
    await TimekeeperAPI.get('/clubs/');

    setOnline(false);

    expect(await TimekeeperAPI.get('/clubs/')).toHaveLength(3);
  });
});
