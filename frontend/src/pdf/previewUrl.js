/**
 * Adresa náhledu PDF, pod kterou má soubor správný název.
 *
 * Náhled se otevírá ve vestavěném prohlížeči PDF. Ten při uložení dává
 * souboru název podle adresy - a adresa blobu je náhodné UUID, takže se
 * listina ukládala jako "5f1c…e2.pdf". Proto se PDF uloží do keše
 * náhledů a service worker (public/sw.js) ho vydá na adrese
 * /pdf-preview/<token>/<název souboru>, kterou prohlížeč použije jako název.
 *
 * Bez aktivního service workeru (první návštěva, soukromé okno) zůstává
 * záložní adresa blobu - náhled funguje, jen s náhodným názvem.
 *
 * Keš náhledů NEJSOU data: drží jen právě zobrazený soubor a po zavření
 * náhledu se maže (staré zbytky po zavřeném okně se uklidí při dalším
 * náhledu). Offline časomíra na ní nestojí - to hlídá test service workeru.
 */
export const PREVIEW_CACHE = 'jmlp-pdf-preview';
export const PREVIEW_PATH = '/pdf-preview/';

/** Náhledy starší než tohle se při dalším náhledu smažou. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

const randomPart = () => Math.random().toString(36).slice(2, 10);

const blobUrl = (blob) => {
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
};

const canUseWorker = () =>
  typeof navigator !== 'undefined' &&
  Boolean(navigator.serviceWorker?.controller) &&
  typeof caches !== 'undefined';

/** Smaže náhledy z dřívějška (zavřená okna, pád prohlížeče). */
async function purgeOld(cache, now) {
  const requests = await cache.keys();
  await Promise.all(
    requests.map((request) => {
      const token = new URL(request.url).pathname.slice(PREVIEW_PATH.length).split('/')[0];
      const created = Number(token.split('-')[0]);
      return Number.isFinite(created) && now - created > MAX_AGE_MS ? cache.delete(request) : null;
    }),
  );
}

/**
 * @param {Blob} blob          PDF
 * @param {string} fileName    název, pod kterým se má soubor uložit
 * @returns {Promise<{url: string, revoke: () => void}>}
 */
export async function createPreviewUrl(blob, fileName, now = Date.now()) {
  if (!canUseWorker()) return blobUrl(blob);
  try {
    const cache = await caches.open(PREVIEW_CACHE);
    await purgeOld(cache, now);
    const url = `${PREVIEW_PATH}${now}-${randomPart()}/${encodeURIComponent(fileName)}`;
    await cache.put(
      url,
      new Response(blob, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        },
      }),
    );
    // Starší verze workeru (těsně po nasazení, než se vymění) adresu nezná
    // a vrátila by obálku aplikace - náhled by v okně ukázal web místo PDF.
    const probe = await fetch(url, { cache: 'no-store' });
    probe.body?.cancel?.();
    if (!(probe.headers.get('Content-Type') || '').includes('application/pdf')) {
      cache.delete(url).catch(() => {});
      return blobUrl(blob);
    }
    return {
      url,
      revoke: () => {
        cache.delete(url).catch(() => {});
      },
    };
  } catch {
    return blobUrl(blob);
  }
}
