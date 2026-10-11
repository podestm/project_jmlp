// Kanárkový build bez starého CSS (JMLP_NO_LEGACY=1, jen lokálně):
//   JMLP_NO_LEGACY=1 npx vite build --outDir dist-canary && npx vite preview --outDir dist-canary
// Přesměruje src/assets/styles/main.css (Bootstrap z CDN, Bootstrap Icons
// a všechny staré partialy) na prázdný soubor a vyhodí inline <style>
// z index.html. Převedená obrazovka musí vypadat stejně v běžném
// i kanárkovém buildu – každý rozdíl znamená závislost na starém CSS.
import { fileURLToPath } from 'node:url';

const LEGACY_ENTRY = /\/src\/assets\/styles\/main\.css$/;
const EMPTY_CSS = fileURLToPath(new URL('./empty.css', import.meta.url));

/** Odstraní z HTML všechny inline <style> bloky (starý blok z index.html). */
export const stripInlineStyles = (html) => html.replace(/[ \t]*<style>[\s\S]*?<\/style>\n?/g, '');

export default function noLegacy() {
  return {
    name: 'jmlp-no-legacy',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved && LEGACY_ENTRY.test(resolved.id.split('?')[0])) return EMPTY_CSS;
      return null;
    },
    transformIndexHtml: {
      order: 'pre',
      handler: stripInlineStyles,
    },
  };
}
