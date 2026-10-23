import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONNECTIVITY_EVENT,
  isNetworkError,
  isNetworkErrorMessage,
  isOnline,
  markReachable,
  markUnreachable,
  onBackOnline,
  onConnectivityChange
} from './connectivity.js';
import { setOnline } from '../test/helpers.js';

const okResponse = () => ({ ok: true, status: 200, redirected: false });

let fetchMock;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('isOnline', () => {
  it('online jen se sítí podle prohlížeče a zároveň dosažitelným serverem', () => {
    expect(isOnline()).toBe(true);
    markUnreachable();
    expect(isOnline()).toBe(false);
    markReachable();
    expect(isOnline()).toBe(true);
    setOnline(false);
    expect(isOnline()).toBe(false);
  });

  it('událost vyšle jen při změně', () => {
    const listener = vi.fn();
    window.addEventListener(CONNECTIVITY_EVENT, listener);
    markUnreachable();
    markUnreachable();
    markReachable();
    markReachable();
    window.removeEventListener(CONNECTIVITY_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('zkouška spojení', () => {
  it('bez markUnreachable se server vůbec nezkouší (veřejný web)', async () => {
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('nedostupný server zkouší s odkladem a po odpovědi ohlásí návrat spojení', async () => {
    const back = vi.fn();
    const stop = onBackOnline(back);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(okResponse());

    markUnreachable();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/^\/health\?ts=\d+/);
    expect(fetchMock.mock.calls[0][1].cache).toBe('no-store');
    expect(isOnline()).toBe(false);

    // Druhý pokus až po delším odkladu (5 s → 10 s).
    await vi.advanceTimersByTimeAsync(9000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(isOnline()).toBe(true);
    expect(back).toHaveBeenCalledTimes(1);

    // Po návratu spojení se už nic nezkouší.
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    stop();
  });

  it('zkouška, která visí, vyprší a spojení zůstane ztracené', async () => {
    fetchMock.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    markUnreachable();
    await vi.advanceTimersByTimeAsync(5000 + 4000);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(isOnline()).toBe(false);
  });

  it('přesměrování (captive portál) za odpověď serveru nepovažuje', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, redirected: true });
    markUnreachable();
    await vi.advanceTimersByTimeAsync(5000);
    expect(isOnline()).toBe(false);
  });

  it('událost prohlížeče online zkusí server hned', async () => {
    fetchMock.mockResolvedValue(okResponse());
    markUnreachable();
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isOnline()).toBe(true);
  });
});

describe('odběry', () => {
  it('onBackOnline: online od prohlížeče se známým dosažitelným serverem', () => {
    const back = vi.fn();
    const stop = onBackOnline(back);
    window.dispatchEvent(new Event('online'));
    expect(back).toHaveBeenCalledTimes(1);

    // Server známý jako nedostupný: na samotnou událost prohlížeče se nečeká.
    markUnreachable();
    window.dispatchEvent(new Event('online'));
    expect(back).toHaveBeenCalledTimes(1);
    stop();
  });

  it('onConnectivityChange dostane aktuální stav', () => {
    const seen = [];
    const stop = onConnectivityChange((online) => seen.push(online));
    markUnreachable();
    markReachable();
    setOnline(false);
    window.dispatchEvent(new Event('offline'));
    stop();
    expect(seen).toEqual([false, true, false]);
  });
});

describe('isNetworkError', () => {
  it('pozná chyby fetch bez odpovědi i vypršení', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new TypeError('Load failed'))).toBe(true);
    expect(isNetworkError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true);
    expect(isNetworkError(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true);
    expect(isNetworkError(Object.assign(new Error('cokoli'), { network: true }))).toBe(true);
  });

  it('chyba s HTTP odpovědí síťová není', () => {
    const error = Object.assign(new Error('API Error: 503 Service Unavailable'), { status: 503 });
    expect(isNetworkError(error)).toBe(false);
    expect(isNetworkError(new Error('Sync failed'))).toBe(false);
    expect(isNetworkErrorMessage('API Error: 504 Gateway Timeout')).toBe(false);
    expect(isNetworkErrorMessage(null)).toBe(false);
  });
});
