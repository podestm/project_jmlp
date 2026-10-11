import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Service worker (public/sw.js) smí kešovat jen obálku aplikace a neměnné
 * soubory - nikdy data.
 *
 * Vzniklo po chybě z ostrého webu: worker posílal všechno, co nezačínalo
 * /api/, do strategie "nejdřív keš, síť až na pozadí". Veřejné API ale běží
 * na holých cestách (/races/, /posts/, /season-results/...), takže web i admin
 * ukazovaly při každé první návštěvě stav z návštěvy minulé - klidně několik
 * dní starý - a pomohlo jen ruční obnovení stránky.
 *
 * Worker se tu spouští v napodobenině prostředí service workeru (self, caches,
 * fetch). Cache API se napodobuje věrně v tom, na čem worker stojí: relativní
 * adresy se vztahují k originu a Cache.put na 206 vyhazuje výjimku.
 */
const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SW_SOURCE = readFileSync(join(FRONTEND, 'public', 'sw.js'), 'utf8');
const ORIGIN = 'https://jmlp.cz';

const response = (body, { status = 200, type = 'text/html' } = {}) => {
  const make = () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? type : null) },
    clone: make,
    text: async () => body
  });
  return make();
};

const createCaches = () => {
  const stores = new Map();
  const keyOf = (request) => new URL(typeof request === 'string' ? request : request.url, ORIGIN).href;
  const storeFor = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  };

  return {
    stores,
    open: async (name) => {
      const store = storeFor(name);
      return {
        put: async (request, res) => {
          if (res.status === 206) throw new TypeError('Partial response (status code 206) is unsupported');
          store.set(keyOf(request), res);
        },
        match: async (request) => store.get(keyOf(request))?.clone()
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    match: async (request) => {
      for (const store of stores.values()) {
        const hit = store.get(keyOf(request));
        if (hit) return hit.clone();
      }
      return undefined;
    },
    /** Co leží v keši pod danou cestou (napříč všemi kešemi). */
    peek: (path) => {
      for (const store of stores.values()) {
        const hit = store.get(new URL(path, ORIGIN).href);
        if (hit) return hit;
      }
      return undefined;
    }
  };
};

class FakeRequest {
  constructor(url, init = {}) {
    this.url = new URL(url, ORIGIN).href;
    this.method = init.method || 'GET';
    this.mode = init.mode || 'cors';
    this.cache = init.cache || 'default';
  }
}

let worker;

const loadWorker = () => {
  const listeners = {};
  const self = {
    location: new URL('/sw.js', ORIGIN),
    addEventListener: (type, handler) => { listeners[type] = handler; },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => {}) }
  };
  const caches = createCaches();
  const fetch = vi.fn(async () => response('', { status: 404 }));

  new Function('self', 'caches', 'fetch', 'Request', SW_SOURCE)(self, caches, fetch, FakeRequest);
  return { listeners, self, caches, fetch };
};

/** Vrátí odpověď workeru, nebo null, když požadavek nechal jít mimo sebe. */
const dispatchFetch = (url, init = {}) => {
  let responded = null;
  worker.listeners.fetch({
    request: new FakeRequest(url, init),
    respondWith: (promise) => { responded = Promise.resolve(promise); }
  });
  return responded;
};

const lifecycle = async (type) => {
  const pending = [];
  worker.listeners[type]({ waitUntil: (promise) => pending.push(promise) });
  await Promise.all(pending);
};

const SHELL_HTML = `<!doctype html><html><head>
<script type="module" crossorigin src="/assets/index-3SAYDQoP.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-BoizPTuT.js">
<link rel="stylesheet" crossorigin href="/assets/index-CJzQrQV0.css">
<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/archivo-latin-ext-700-normal-Bx3kQ9aZ.woff2">
<link rel="icon" href="/favicon.ico">
</head><body><div id="root"></div></body></html>`;

beforeEach(() => {
  worker = loadWorker();
});

/**
 * Datové cesty webu, administrace i časoměřiče (viz nginx.conf). Kdyby se
 * vrátilo výchozí "kešuj všechno", spadne tahle tabulka.
 */
const DATA_PATHS = [
  '/races/',
  '/races/?current_season=true',
  '/races/132',
  '/races/132/registrations',
  '/races/132/proposition',
  '/races/132/results',
  '/races/live/status',
  '/posts/',
  '/posts/?limit=3',
  '/posts/5/image?v=2',
  '/clubs/',
  '/season-results/',
  '/documents',
  '/racers/search?name=Jan',
  '/registrations/',
  '/visitor-log',
  '/uploads/documents/4be803bd0a3f48d084fd3bc3b2a5e44e.pdf',
  '/api/admin/races',
  '/api/timekeeper/races',
  '/api/timekeeper/races/132/start-list',
  '/manifest.json',
  '/sw.js'
];

describe('data jdou mimo service worker', () => {
  it.each(DATA_PATHS)('%s', (path) => {
    expect(dispatchFetch(path)).toBeNull();
    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it('zápisy worker nechává být', () => {
    expect(dispatchFetch('/assets/index-3SAYDQoP.js', { method: 'POST' })).toBeNull();
  });

  it('cizí origin worker nechává být', () => {
    expect(dispatchFetch('https://example.org/style.css')).toBeNull();
  });
});

describe('neměnné soubory', () => {
  it('soubor z /assets se stáhne jednou a pak jde z keše', async () => {
    worker.fetch.mockResolvedValue(response('console.log(1)', { type: 'text/javascript' }));

    await dispatchFetch('/assets/index-3SAYDQoP.js');
    const second = await dispatchFetch('/assets/index-3SAYDQoP.js');

    expect(await second.text()).toBe('console.log(1)');
    expect(worker.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(['/favicon.ico', '/favicon-32x32.png', '/apple-touch-icon.png'])('ikona %s se kešuje', async (path) => {
    worker.fetch.mockResolvedValue(response('png', { type: 'image/png' }));

    await dispatchFetch(path);

    expect(worker.caches.peek(path)).toBeDefined();
  });

  it('chybová odpověď se do keše neuloží', async () => {
    worker.fetch.mockResolvedValue(response('nenalezeno', { status: 404 }));

    const res = await dispatchFetch('/assets/stary-soubor-abc123.js');

    expect(res.status).toBe(404);
    expect(worker.caches.peek('/assets/stary-soubor-abc123.js')).toBeUndefined();
  });

  it('částečná odpověď (206) projde, jen se neuloží', async () => {
    worker.fetch.mockResolvedValue(response('kus', { status: 206, type: 'font/woff2' }));

    const res = await dispatchFetch('/assets/font-abc123.woff2');

    expect(res.status).toBe(206);
    expect(worker.caches.peek('/assets/font-abc123.woff2')).toBeUndefined();
  });
});

describe('obálka aplikace', () => {
  it('online navigace jde vždy na síť a obálku uloží', async () => {
    worker.fetch.mockResolvedValue(response(SHELL_HTML));

    const res = await dispatchFetch('/zavody', { mode: 'navigate' });

    expect(await res.text()).toBe(SHELL_HTML);
    expect(worker.fetch).toHaveBeenCalledTimes(1);
    expect(worker.caches.peek('/index.html')).toBeDefined();
  });

  it('offline navigace dostane poslední uloženou obálku', async () => {
    worker.fetch.mockResolvedValueOnce(response(SHELL_HTML));
    await dispatchFetch('/timekeeper', { mode: 'navigate' });

    worker.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const res = await dispatchFetch('/timekeeper/timing', { mode: 'navigate' });

    expect(await res.text()).toBe(SHELL_HTML);
  });

  it('offline navigace bez uložené obálky selže jako bez workeru', async () => {
    worker.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(dispatchFetch('/zavody', { mode: 'navigate' })).rejects.toThrow('Failed to fetch');
  });

  it('otevřené PDF obálku nepřepíše', async () => {
    worker.fetch.mockResolvedValueOnce(response(SHELL_HTML));
    await dispatchFetch('/', { mode: 'navigate' });

    // Propozice a výsledky se otevírají přes target="_blank" - taky navigace
    worker.fetch.mockResolvedValueOnce(response('%PDF-1.4', { type: 'application/pdf' }));
    await dispatchFetch('/races/132/results', { mode: 'navigate' });

    expect(await worker.caches.peek('/index.html').text()).toBe(SHELL_HTML);
  });

  it('chybová stránka obálku nepřepíše', async () => {
    worker.fetch.mockResolvedValueOnce(response(SHELL_HTML));
    await dispatchFetch('/', { mode: 'navigate' });

    worker.fetch.mockResolvedValueOnce(response('<h1>502 Bad Gateway</h1>', { status: 502 }));
    const res = await dispatchFetch('/zavody', { mode: 'navigate' });

    expect(res.status).toBe(502);
    expect(await worker.caches.peek('/index.html').text()).toBe(SHELL_HTML);
  });
});

describe('náhled PDF pod názvem souboru', () => {
  it('náhled z keše náhledů - prohlížeč PDF ho uloží pod názvem z adresy', async () => {
    const nahledy = await worker.caches.open('jmlp-pdf-preview');
    await nahledy.put('/pdf-preview/1-a/2026-10-03_JMLP2026-01_vysledky.pdf', response('%PDF', { type: 'application/pdf' }));

    // Iframe náhledu je navigace - nesmí dostat obálku aplikace.
    const odpoved = await dispatchFetch('/pdf-preview/1-a/2026-10-03_JMLP2026-01_vysledky.pdf', { mode: 'navigate' });

    expect(odpoved.headers.get('content-type')).toBe('application/pdf');
    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it('zavřený náhled vrátí 404, ne obálku aplikace', async () => {
    const odpoved = await dispatchFetch('/pdf-preview/1-a/zavreny.pdf', { mode: 'navigate' });

    expect(odpoved.status).toBe(404);
    expect(worker.fetch).not.toHaveBeenCalled();
  });
});

describe('instalace a aktivace', () => {
  const serveShell = ({ failing = [] } = {}) => {
    worker.fetch.mockImplementation(async (request) => {
      const url = typeof request === 'string' ? request : request.url;
      const path = new URL(url, ORIGIN).pathname;
      if (path === '/index.html') return response(SHELL_HTML);
      if (failing.includes(path)) throw new TypeError('Failed to fetch');
      return response(`obsah ${path}`, { type: 'text/javascript' });
    });
  };

  it('instalace uloží obálku i všechny její soubory, bez opisování hashů', async () => {
    serveShell();

    await lifecycle('install');

    expect(worker.caches.peek('/index.html')).toBeDefined();
    expect(worker.caches.peek('/assets/index-3SAYDQoP.js')).toBeDefined();
    expect(worker.caches.peek('/assets/vendor-BoizPTuT.js')).toBeDefined();
    expect(worker.caches.peek('/assets/index-CJzQrQV0.css')).toBeDefined();
    // Písma Modré stopy (preload z vite/fontPreload.js) - offline start časomíry.
    expect(worker.caches.peek('/assets/archivo-latin-ext-700-normal-Bx3kQ9aZ.woff2')).toBeDefined();
    expect(worker.self.skipWaiting).toHaveBeenCalled();
  });

  it('obálka se při instalaci stahuje mimo HTTP keš prohlížeče', async () => {
    serveShell();

    await lifecycle('install');

    const shellRequest = worker.fetch.mock.calls
      .map(([request]) => request)
      .find((request) => typeof request !== 'string' && request.url === `${ORIGIN}/index.html`);
    expect(shellRequest.cache).toBe('reload');
  });

  it('jeden nedostupný soubor instalaci neshodí', async () => {
    serveShell({ failing: ['/assets/vendor-BoizPTuT.js'] });

    await lifecycle('install');

    expect(worker.caches.peek('/assets/index-3SAYDQoP.js')).toBeDefined();
    expect(worker.caches.peek('/assets/vendor-BoizPTuT.js')).toBeUndefined();
  });

  it('bez obálky instalace selže - zůstane aktivní stará verze workeru', async () => {
    worker.fetch.mockResolvedValue(response('', { status: 503 }));

    await expect(lifecycle('install')).rejects.toThrow('503');
  });

  it('aktivace nechá keš náhledů PDF - patří otevřenému náhledu, ne verzi workeru', async () => {
    const nahledy = await worker.caches.open('jmlp-pdf-preview');
    await nahledy.put('/pdf-preview/1-a/vysledky.pdf', response('%PDF', { type: 'application/pdf' }));
    serveShell();
    await lifecycle('install');

    await lifecycle('activate');

    expect((await worker.caches.keys()).sort()).toEqual(['jmlp-pdf-preview', 'jmlp-shell-v6']);
  });

  it('aktivace smaže starší keše i s daty, která v nich zůstala', async () => {
    const stara = await worker.caches.open('jmlp-timekeeper-v3');
    await stara.put('/races/', response('[]', { type: 'application/json' }));
    serveShell();
    await lifecycle('install');

    await lifecycle('activate');

    expect(await worker.caches.keys()).toEqual(['jmlp-shell-v6']);
    expect(worker.caches.peek('/races/')).toBeUndefined();
    expect(worker.self.clients.claim).toHaveBeenCalled();
  });
});

/**
 * Offline režim časoměřiče stojí na IndexedDB (src/offline/), ne na keši
 * workeru. Tyhle kontroly hlídají, aby se na ni znovu nezačalo spoléhat.
 */
describe('časoměřič na keši workeru nestojí', () => {
  const SRC = join(FRONTEND, 'src');
  const sourceFiles = (dir) => readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name) ? [full] : [];
  });

  it('aplikace se Cache Storage nedotýká', () => {
    // Jediná výjimka: náhled PDF (pdf/previewUrl.js) tam na chvíli odkládá
    // právě zobrazený soubor, aby ho prohlížeč uložil pod správným názvem.
    // Nejsou to data a po zavření náhledu se mažou.
    const ALLOWED = ['pdf/previewUrl.js'];
    const offenders = sourceFiles(SRC)
      .filter((file) => /\bcaches\.(open|match|keys|delete|has)\b/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file))
      .filter((file) => !ALLOWED.includes(file.split('\\').join('/')));

    expect(offenders).toEqual([]);
  });

  it('obrazovky časoměřiče nečtou data přes veřejného klienta', () => {
    // Veřejný klient (config/api.js) offline cache nemá - offline fungoval jen
    // díky keši workeru. Časoměřič musí číst přes TimekeeperAPI (IndexedDB).
    const offenders = sourceFiles(join(SRC, 'components', 'timekeeper'))
      .filter((file) => /import\s+(API\b|\{[^}]*\bAPI\b[^}]*\})[^;]*from\s+'[./]+config\/api\.js'/
        .test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual([]);
  });
});
