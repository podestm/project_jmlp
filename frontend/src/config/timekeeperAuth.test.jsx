import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AUTH_EXPIRED_EVENT } from './api.js';
import { SESSION_TOKEN_KEY, SESSION_USER_KEY } from './session.js';

const flushQueue = vi.fn(async () => {});
const releaseAuthParked = vi.fn(async () => 2);
vi.mock('./timekeeperApi.js', () => ({ startTimekeeperSync: () => () => {}, TimekeeperAPI: { flushQueue } }));
vi.mock('../offline/syncQueue.js', () => ({ releaseAuthParked }));
vi.mock('../offline/sync.js', () => ({ AUTH_EXPIRED_MESSAGE: 'auth-expired' }));
vi.mock('./tokenRefresh.js', () => ({ startTokenRefresh: () => ({ stop: () => {} }) }));

const { TimekeeperAuthProvider, useTimekeeperAuth } = await import('./timekeeperAuth.jsx');

const PROFILE = { email: 'cas@jmlp.cz', role: 'timekeeper' };
const respond = (body, status = 200) => ({
  ok: status < 400, status, statusText: status < 400 ? 'OK' : 'Error',
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => body, text: async () => JSON.stringify(body)
});
const setOnline = (value) => Object.defineProperty(navigator, 'onLine', { value, configurable: true });

const renderAuth = () => renderHook(() => useTimekeeperAuth(), { wrapper: TimekeeperAuthProvider });

describe('časomíra nikoho sama neodhlásí', () => {
  beforeEach(() => {
    localStorage.clear();
    flushQueue.mockClear();
    releaseAuthParked.mockClear();
    setOnline(true);
    global.fetch = vi.fn(async (url) => {
      const path = String(url);
      if (path.endsWith('/auth/login')) return respond({ access_token: 'novy', token_type: 'bearer', expires_in: 43200 });
      if (path.endsWith('/auth/me')) return respond(PROFILE);
      return respond({});
    });
  });
  afterEach(() => setOnline(true));

  it('401 během práce otevře přihlášení na místě, profil i obrazovka zůstanou', async () => {
    localStorage.setItem(SESSION_TOKEN_KEY, 'platny');
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(PROFILE));

    act(() => {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { section: '/timekeeper', tokenCleared: true } }));
    });

    expect(result.current.reauthRequired).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem(SESSION_USER_KEY)).not.toBeNull();
  });

  it('vypršelé přihlášení při startu online: okno na místě, ne přihlašovací stránka', async () => {
    localStorage.setItem(SESSION_TOKEN_KEY, 'stary');
    localStorage.setItem(`${SESSION_TOKEN_KEY}_expires_at`, String(Date.now() - 1000));
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(PROFILE));

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.reauthRequired).toBe(true);
  });

  it('offline s vypršelým přihlášením se dál měří, žádné okno', async () => {
    setOnline(false);
    localStorage.setItem(SESSION_TOKEN_KEY, 'stary');
    localStorage.setItem(`${SESSION_TOKEN_KEY}_expires_at`, String(Date.now() - 1000));
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(PROFILE));

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.reauthRequired).toBe(false);
  });

  it('po přihlášení v okně pokračuje fronta', async () => {
    localStorage.setItem(SESSION_TOKEN_KEY, 'stary');
    localStorage.setItem(`${SESSION_TOKEN_KEY}_expires_at`, String(Date.now() - 1000));
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(PROFILE));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.reauthRequired).toBe(true));

    await act(async () => { await result.current.login('cas@jmlp.cz', 'heslo'); });

    expect(result.current.reauthRequired).toBe(false);
    expect(localStorage.getItem(SESSION_TOKEN_KEY)).toBe('novy');
    await waitFor(() => expect(flushQueue).toHaveBeenCalled());
    expect(releaseAuthParked).toHaveBeenCalledWith('auth-expired');
  });
});
