import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeTokenTimes, needsRefresh, startTokenRefresh } from './tokenRefresh.js';

const NOW = 1_800_000_000_000;
const b64 = (obj) =>
  btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (claims) => `${b64({ alg: 'HS256' })}.${b64(claims)}.sig`;
const sec = (ms) => Math.floor(ms / 1000);

describe('klouzavé prodlužování přihlášení', () => {
  it('čte exp a iat z tokenu', () => {
    expect(decodeTokenTimes(jwt({ exp: 200, iat: 100 }))).toEqual({ exp: 200, iat: 100 });
    expect(decodeTokenTimes(jwt({ exp: 200 }))).toEqual({ exp: 200, iat: null });
    expect(decodeTokenTimes('nesmysl')).toBeNull();
  });

  it('obnovuje, až zbývá méně než půlka platnosti', () => {
    const issued = sec(NOW) - 5 * 3600;
    expect(needsRefresh(jwt({ iat: issued, exp: issued + 12 * 3600 }), NOW)).toBe(false); // zbývá 7 h z 12
    expect(needsRefresh(jwt({ iat: issued - 2 * 3600, exp: issued + 10 * 3600 }), NOW)).toBe(true); // zbývá 5 h z 12
  });

  it('vypršelý token neobnovuje; bez iat počítá s 12 h', () => {
    expect(needsRefresh(jwt({ iat: 1, exp: sec(NOW) - 1 }), NOW)).toBe(false);
    expect(needsRefresh(jwt({ exp: sec(NOW) + 5 * 3600 }), NOW)).toBe(true);
    expect(needsRefresh(jwt({ exp: sec(NOW) + 7 * 3600 }), NOW)).toBe(false);
  });

  describe('hlídač', () => {
    let saved;
    const store = (token) => ({
      getToken: () => token,
      save: vi.fn((t, e) => {
        saved = [t, e];
      }),
    });

    beforeEach(() => {
      saved = null;
      vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
      global.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'novy', expires_in: 43200 }),
      }));
    });
    afterEach(() => {
      vi.useRealTimers();
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    });

    it('online a za půlkou platnosti obnoví a uloží nový token', async () => {
      const old = jwt({ iat: sec(NOW) - 8 * 3600, exp: sec(NOW) + 4 * 3600 });
      const onRefreshed = vi.fn();
      const refresher = startTokenRefresh({
        endpoint: '/api/timekeeper/auth/refresh',
        store: store(old),
        onRefreshed,
      });
      await vi.waitFor(() => expect(onRefreshed).toHaveBeenCalledWith('novy'));
      refresher.stop();
      expect(saved).toEqual(['novy', 43200]);
      const [url, init] = global.fetch.mock.calls[0];
      expect(String(url)).toContain('/api/timekeeper/auth/refresh');
      expect(init.headers.Authorization).toBe(`Bearer ${old}`);
    });

    it('offline nic neposílá', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      const refresher = startTokenRefresh({
        endpoint: '/x',
        store: store(jwt({ iat: 0, exp: sec(NOW) + 60 })),
      });
      expect(await refresher.check()).toBe(false);
      refresher.stop();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('nepovedená obnova token nemaže', async () => {
      global.fetch = vi.fn(async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({}),
      }));
      const s = store(jwt({ iat: sec(NOW) - 8 * 3600, exp: sec(NOW) + 3600 }));
      const refresher = startTokenRefresh({ endpoint: '/x', store: s });
      expect(await refresher.check()).toBe(false);
      refresher.stop();
      expect(s.save).not.toHaveBeenCalled();
    });
  });
});
