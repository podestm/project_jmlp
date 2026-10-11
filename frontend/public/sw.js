// Service worker JMLP.
//
// Jediný úkol: aby se aplikace načetla i bez sítě - kvůli časoměřičské sekci,
// která na závodech jede na mizerném připojení. Nic jiného tenhle soubor neřeší.
//
// DATA SE NEKEŠUJÍ. Dřív sem padalo všechno, co nezačínalo /api/, do strategie
// "nejdřív keš, síť až na pozadí". Jenže veřejné API běží na holých cestách
// (/races/, /posts/, /clubs/, /season-results/, /documents, /racers/search),
// takže veřejný web i admin ukazovaly při každé návštěvě stav z návštěvy
// minulé - kdo se dívá jednou za den, viděl včerejšek - a musely se ručně
// obnovovat. Proto je výchozí chování "nesahat na to" a kešuje se jen to, co je
// níž vyjmenované. Nový endpoint tím pádem nemůže do keše spadnout omylem.
//
// Offline režim časoměřiče na tomhle souboru NESTOJÍ - ten má vlastní úložiště
// v IndexedDB (src/offline/, src/config/timekeeperApi.js) a Cache Storage se
// nikde v src/ nedotýká. Service worker mu dodává jen samotný start aplikace.
//
// CACHE_NAME se zvedá ručně. Při jeho změně aktivace smaže všechny starší keše,
// takže se z prohlížečů uklidí i data, která tam nakešovaly starší verze.
const CACHE_NAME = 'jmlp-shell-v7';
const SHELL_URL = '/index.html';

// Náhledy tištěných listin (src/pdf/previewUrl.js). Stránka do téhle keše
// vloží právě zobrazené PDF a worker ho vydá na adrese
// /pdf-preview/<token>/<název souboru> - prohlížeč PDF pak soubor při uložení
// pojmenuje podle ní, ne náhodným UUID blobu. Nejsou to data: po zavření
// náhledu stránka položku smaže a aktivace nové verze tuhle keš nechává být.
const PREVIEW_CACHE = 'jmlp-pdf-preview';
const PREVIEW_PATH = '/pdf-preview/';

/**
 * Kešovat se smí jen obsah, který se pod danou URL už nikdy nezmění:
 * - /assets/* generuje Vite s hashem obsahu (assets/[name]-[hash].[ext]),
 *   takže nová verze souboru = nová URL (viz vite.config.js),
 * - ikony obsahem adresované NEJSOU. Drží se tu proto, že se mění jednou za
 *   roky - ale když se některá vymění, MUSÍ se zvednout CACHE_NAME, jinak si
 *   ji prohlížeče nechají navždy.
 *
 * Schválně tu NENÍ /uploads/ (řeší si to hlavičkou Cache-Control z backendu),
 * /posts/{id}/image (má ETag a ?v= z API.getImageUrl), manifest.json ani sw.js
 * (nginx je posílá jako no-cache) a pochopitelně žádné API.
 */
const CACHEABLE_PATHS = [
  /^\/assets\//,
  /^\/favicon(-\d+x\d+)?\.(ico|png)$/,
  /^\/apple-touch-icon\.png$/
];

const isCacheable = (pathname) => CACHEABLE_PATHS.some((pattern) => pattern.test(pathname));

const isHtml = (response) => (response.headers.get('Content-Type') || '').includes('text/html');

/**
 * Uloží obálku aplikace i soubory, na které se odkazuje.
 *
 * Samotné index.html na offline start nestačí - bez svých skriptů a stylů se
 * vykreslí prázdná stránka. Dřív se /assets/* dostávaly do keše mimochodem,
 * protože se kešovalo úplně všechno; teď se musí uložit tady, jinak by mezi
 * nasazením a dalším online načtením vzniklo okno, kdy časoměřič offline
 * nenastartuje.
 *
 * Adresy se čtou přímo z HTML, takže se tu neopisují hashe, které Vite mění
 * při každém buildu.
 */
const precacheShell = async (cache) => {
  // cache: 'reload' obejde HTTP keš prohlížeče - uloží se index.html z toho
  // nasazení, se kterým přišel i tenhle sw.js.
  const response = await fetch(new Request(SHELL_URL, { cache: 'reload' }));
  if (!response.ok) throw new Error(`Obálku se nepodařilo načíst: ${response.status}`);

  const html = await response.clone().text();
  await cache.put(SHELL_URL, response);

  const assets = [...new Set(
    [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])
  )];

  // allSettled: jeden nedostupný soubor nesmí shodit celou instalaci. Kdyby
  // spadla celá, zůstane aktivní stará verze workeru - což je pořád lepší než
  // půlka nové.
  await Promise.allSettled(assets.map(async (url) => {
    const asset = await fetch(url);
    if (asset.status === 200) await cache.put(url, asset);
  }));
};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(precacheShell));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== PREVIEW_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/**
 * Neměnný soubor: co je jednou v keši, je správně - revalidovat není co.
 */
const cacheFirst = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  // Jen 200: Cache.put na 206 (Partial Content) vyhodí výjimku, která by
  // shodila celou odpověď, přestože síť odpověděla v pořádku.
  if (response.status === 200) {
    await cache.put(request, response.clone());
  }
  return response;
};

/**
 * Navigace (HTML) jde vždy na síť, z keše se bere až když síť selže. Online
 * uživatel tedy nikdy nedostane starou obálku aplikace; offline se časoměřiči
 * nastartuje aspoň poslední známá verze.
 */
const shellFromNetwork = async (request) => {
  try {
    const response = await fetch(request);
    // Uložit se smí jen HTML. Odkazy na PDF (propozice, výsledky, dokumenty)
    // se otevírají přes target="_blank", což je taky navigace - bez téhle
    // pojistky by se do /index.html uložilo PDF a časoměřič by offline
    // nabootoval stažený soubor místo aplikace.
    if (response.ok && isHtml(response)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(SHELL_URL);
    if (cached) return cached;
    throw error;
  }
};

/** Náhled PDF z keše náhledů; po zavření náhledu už není co vydat. */
const previewFromCache = async (request) => {
  const cache = await caches.open(PREVIEW_CACHE);
  const hit = await cache.match(request.url);
  return hit || new Response('Náhled už není k dispozici - vygenerujte listinu znovu.', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Náhled se otevírá v iframu, tedy jako navigace - musí přijít dřív než obálka.
  if (url.pathname.startsWith(PREVIEW_PATH)) {
    event.respondWith(previewFromCache(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(shellFromNetwork(request));
    return;
  }

  if (isCacheable(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Všechno ostatní - tedy všechna data - se nechává projít bez zásahu
  // service workeru. Žádné respondWith = normální síťový požadavek.
});
