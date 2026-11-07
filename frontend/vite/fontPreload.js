// Vite plugin: do index.html vloží <link rel="preload" as="font"> pro každé
// písmo Modré stopy (src/styles/ms/fonts.css) s hashovanou URL z buildu.
//
// Hlavní důvod je offline časomíra: service worker při instalaci předkešuje
// všechno, na co index.html odkazuje (precacheShell v public/sw.js). Bez
// odkazu v HTML by se písma do keše dostala až při prvním vykreslení textu
// v daném řezu – a offline start by pak běžel se systémovým písmem.

const FONT_FILE =
  /(?:^|\/)(?:archivo|source-sans-3|ibm-plex-mono)-latin(?:-ext)?-\d{3}-normal-[\w-]+\.woff2$/;

/** Tagy pro všechna písma Modré stopy v bundlu (seřazené kvůli stabilnímu HTML). */
export const fontPreloadTags = (bundle, base = '/') =>
  Object.keys(bundle)
    .filter((fileName) => FONT_FILE.test(fileName))
    .sort()
    .map((fileName) => ({
      tag: 'link',
      attrs: {
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        crossorigin: '',
        href: `${base}${fileName}`,
      },
      injectTo: 'head',
    }));

export default function fontPreload() {
  let base = '/';
  return {
    name: 'jmlp-font-preload',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler: (html, ctx) => (ctx.bundle ? fontPreloadTags(ctx.bundle, base) : []),
    },
  };
}
