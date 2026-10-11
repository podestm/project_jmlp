import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { migrateLegacySession, SESSION_TOKEN_KEY, SESSION_USER_KEY } from './session.js';
import { AuthProvider, useAuth } from './auth.jsx';
import { TimekeeperAuthProvider, useTimekeeperAuth } from './timekeeperAuth.jsx';
import { MemoryRouter } from 'react-router-dom';
import AdminLogin from '../components/admin/AdminLogin/AdminLogin.jsx';

vi.mock('./timekeeperApi.js', () => ({ startTimekeeperSync: () => () => {} }));

const NOW = 1_800_000_000_000;

describe('převod přihlášení ze starších verzí', () => {
  beforeEach(() => localStorage.clear());

  it('platné přihlášení časomíry převezme i s profilem pro offline start', () => {
    localStorage.setItem('timekeeper_token', 'tk');
    localStorage.setItem('timekeeper_token_expires_at', String(NOW + 1000));
    localStorage.setItem('timekeeper_user', '{"email":"c@x.cz","role":"timekeeper"}');

    migrateLegacySession(localStorage, NOW);

    expect(localStorage.getItem(SESSION_TOKEN_KEY)).toBe('tk');
    expect(localStorage.getItem(`${SESSION_TOKEN_KEY}_expires_at`)).toBe(String(NOW + 1000));
    expect(localStorage.getItem(SESSION_USER_KEY)).toBe('{"email":"c@x.cz","role":"timekeeper"}');
    expect(localStorage.getItem('timekeeper_token')).toBeNull();
    expect(localStorage.getItem('timekeeper_user')).toBeNull();
  });

  it('z obou platných vyhraje novější přihlášení; cizí profil se nepřevezme', () => {
    localStorage.setItem('timekeeper_token', 'tk');
    localStorage.setItem('timekeeper_token_expires_at', String(NOW + 1000));
    localStorage.setItem('timekeeper_user', '{"role":"timekeeper"}');
    localStorage.setItem('admin_token', 'adm');
    localStorage.setItem('admin_token_expires_at', String(NOW + 5000));

    migrateLegacySession(localStorage, NOW);

    expect(localStorage.getItem(SESSION_TOKEN_KEY)).toBe('adm');
    expect(localStorage.getItem(SESSION_USER_KEY)).toBeNull();
    expect(localStorage.getItem('admin_token')).toBeNull();
  });

  it('prošlé přihlášení nepřevezme', () => {
    localStorage.setItem('admin_token', 'old');
    localStorage.setItem('admin_token_expires_at', String(NOW - 1));

    migrateLegacySession(localStorage, NOW);

    expect(localStorage.getItem(SESSION_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem('admin_token')).toBeNull();
  });

  it('společné přihlášení nepřepíše', () => {
    localStorage.setItem(SESSION_TOKEN_KEY, 'current');
    localStorage.setItem('admin_token', 'adm');

    migrateLegacySession(localStorage, NOW);

    expect(localStorage.getItem(SESSION_TOKEN_KEY)).toBe('current');
    expect(localStorage.getItem('admin_token')).toBeNull();
  });
});

const respond = (body, status = 200) => ({
  ok: status < 400,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => body,
  text: async () => JSON.stringify(body)
});

const mockServer = (profile) => vi.fn(async (url) => {
  const path = String(url);
  if (path.endsWith('/auth/login')) return respond({ access_token: 'shared-token', token_type: 'bearer', expires_in: 43200 });
  if (path.endsWith('/auth/me')) return respond(profile);
  return respond([]);
});

describe('jedno přihlášení pro administraci i časomíru', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('kdo se přihlásí v časomíře, je jako správce přihlášený i v administraci', async () => {
    vi.stubGlobal('fetch', mockServer({ id: 4, email: 'ivo@x.cz', role: 'admin' }));
    const timekeeper = renderHook(() => useTimekeeperAuth(), { wrapper: TimekeeperAuthProvider });
    await waitFor(() => expect(timekeeper.result.current.loading).toBe(false));

    await act(async () => { await timekeeper.result.current.login('ivo@x.cz', 'heslo'); });
    expect(localStorage.getItem(SESSION_TOKEN_KEY)).toBe('shared-token');

    const admin = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(admin.result.current.isAuthenticated).toBe(true));
    expect(admin.result.current.admin.email).toBe('ivo@x.cz');
  });

  it('časoměřič do administrace nesmí, ale z časomíry ho to neodhlásí', async () => {
    localStorage.setItem(SESSION_TOKEN_KEY, 'shared-token');
    vi.stubGlobal('fetch', mockServer({ id: 5, email: 'renata@x.cz', role: 'timekeeper' }));

    const admin = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(admin.result.current.loading).toBe(false));

    expect(admin.result.current.isAuthenticated).toBe(false);
    expect(admin.result.current.deniedUser.email).toBe('renata@x.cz');
    expect(localStorage.getItem(SESSION_TOKEN_KEY)).toBe('shared-token');

    const timekeeper = renderHook(() => useTimekeeperAuth(), { wrapper: TimekeeperAuthProvider });
    await waitFor(() => expect(timekeeper.result.current.isAuthenticated).toBe(true));
  });

  it('přihlašovací stránka administrace časoměřiči vysvětlí, proč dovnitř nemůže', async () => {
    localStorage.setItem(SESSION_TOKEN_KEY, 'shared-token');
    vi.stubGlobal('fetch', mockServer({ id: 5, email: 'renata@x.cz', role: 'timekeeper' }));

    render(<MemoryRouter><AuthProvider><AdminLogin /></AuthProvider></MemoryRouter>);

    expect(await screen.findByText(/smí jen do časomíry/)).toHaveTextContent('renata@x.cz');
  });

  it('odhlášení v administraci odhlásí i časomíru', async () => {
    localStorage.setItem(SESSION_TOKEN_KEY, 'shared-token');
    localStorage.setItem(SESSION_USER_KEY, '{"role":"admin"}');
    vi.stubGlobal('fetch', mockServer({ id: 4, email: 'ivo@x.cz', role: 'admin' }));

    const admin = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(admin.result.current.isAuthenticated).toBe(true));
    act(() => admin.result.current.logout());

    expect(localStorage.getItem(SESSION_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_USER_KEY)).toBeNull();
  });

  it('výpadek sítě v administraci společné přihlášení nesmaže', async () => {
    localStorage.setItem(SESSION_TOKEN_KEY, 'shared-token');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const admin = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(admin.result.current.loading).toBe(false));

    expect(localStorage.getItem(SESSION_TOKEN_KEY)).toBe('shared-token');
  });
});
