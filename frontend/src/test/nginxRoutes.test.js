import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Nginx vrací pro cesty, které router nezná, skutečný stav 404 (frontend/nginx.conf,
 * map $jmlp_spa_route). Kdyby v mapě chyběla nová routa, stránka by se sice
 * vykreslila, ale s chybovým stavem - vyhledávač by ji zahodil. Proto: každá
 * <Route path> z Routeru musí v mapě projít a neznámá adresa ne.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const nginx = readFileSync(join(HERE, '../../nginx.conf'), 'utf8');
const router = readFileSync(join(HERE, '../Router.jsx'), 'utf8');

const mapBlock = nginx.match(/map \$uri \$jmlp_spa_route \{([\s\S]*?)\}/)[1];
const patterns = [...mapBlock.matchAll(/^\s*~(\S+)\s+1;/gm)].map((m) => new RegExp(m[1]));
const isSpaRoute = (path) => patterns.some((re) => re.test(path));

/** Ukázková adresa pro každou routu: :param → 123, /* → /cokoli. */
const sampleOf = (path) => path.replace(/:[^/]+/g, '123').replace(/\/\*$/, '/cokoli');

const routes = [...router.matchAll(/<Route\s+path="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((path) => path !== '*' && path !== '/__ms');

describe('nginx a routy aplikace', () => {
  it('mapa v nginx.conf existuje', () => {
    expect(patterns.length).toBeGreaterThan(0);
  });

  it.each(routes)('%s projde jako stránka aplikace (200)', (path) => {
    expect(isSpaRoute(sampleOf(path))).toBe(true);
  });

  it.each(['/tohle-neexistuje', '/zavod', '/wp-login.php', '/zavody/stara-stranka'])('%s dostane 404', (path) => {
    expect(isSpaRoute(path)).toBe(false);
  });
});
