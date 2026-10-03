import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPreviewUrl, PREVIEW_CACHE } from './previewUrl.js';

/*
 * Náhled PDF pod adresou s názvem souboru - prohlížeč PDF podle ní soubor
 * při uložení pojmenuje (dřív náhodné UUID blobu).
 */
const fakeCaches = () => {
  const store = new Map();
  const cache = {
    put: vi.fn(async (url, response) => { store.set(new URL(url, 'https://jmlp.cz').href, response); }),
    keys: vi.fn(async () => [...store.keys()].map((url) => ({ url }))),
    delete: vi.fn(async (request) => store.delete(typeof request === 'string' ? new URL(request, 'https://jmlp.cz').href : request.url))
  };
  return { store, cache, open: vi.fn(async () => cache) };
};

let caches;

beforeEach(() => {
  caches = fakeCaches();
  vi.stubGlobal('caches', caches);
  vi.stubGlobal('navigator', { serviceWorker: { controller: {} } });
  vi.stubGlobal('fetch', vi.fn(async () => ({ headers: new Headers({ 'Content-Type': 'application/pdf' }) })));
  URL.createObjectURL = vi.fn(() => 'blob:nahodne-uuid');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
const NAME = '2026-10-03_JMLP2026-01_vysledky.pdf';

describe('náhled PDF pod správným názvem', () => {
  it('soubor je v keši náhledů pod adresou končící názvem souboru', async () => {
    const preview = await createPreviewUrl(pdf, NAME, 1000);

    expect(preview.url).toMatch(/^\/pdf-preview\/1000-[a-z0-9]+\/2026-10-03_JMLP2026-01_vysledky\.pdf$/);
    expect(caches.open).toHaveBeenCalledWith(PREVIEW_CACHE);
    const stored = [...caches.store.values()][0];
    expect(stored.headers.get('Content-Type')).toBe('application/pdf');
    expect(stored.headers.get('Content-Disposition')).toContain(encodeURIComponent(NAME));

    preview.revoke();
    await Promise.resolve();
    expect(caches.store.size).toBe(0);
  });

  it('staré náhledy (zavřená okna) se uklidí', async () => {
    await createPreviewUrl(pdf, 'stary.pdf', 1000);
    await createPreviewUrl(pdf, NAME, 1000 + 13 * 60 * 60 * 1000);

    expect([...caches.store.keys()].map((url) => url.split('/').pop())).toEqual([NAME]);
  });

  it('bez service workeru zůstane adresa blobu', async () => {
    vi.stubGlobal('navigator', { serviceWorker: { controller: null } });

    expect((await createPreviewUrl(pdf, NAME)).url).toBe('blob:nahodne-uuid');
  });

  it('starší worker, který adresu nezná, náhled nerozbije', async () => {
    // Stará verze workeru by na adrese vrátila obálku aplikace.
    fetch.mockResolvedValue({ headers: new Headers({ 'Content-Type': 'text/html' }) });

    const preview = await createPreviewUrl(pdf, NAME);

    expect(preview.url).toBe('blob:nahodne-uuid');
    await Promise.resolve();
    expect(caches.store.size).toBe(0);
  });
});
