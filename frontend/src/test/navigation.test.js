import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Na každou obrazovku musí vést odkaz z menu.
 *
 * Vzniklo po konkrétní ztrátě: routy /admin/clubs (správa klubů a jejich log)
 * a /timekeeper/race-detail (údaje závodu do hlavičky výsledkové listiny)
 * existovaly, komponenty existovaly, build i testy procházely - jen na ně
 * nevedl žádný odkaz, takže z pohledu obsluhy ty funkce prostě zmizely.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

const read = (relative) => readFileSync(join(SRC, relative), 'utf8');

const routesOf = (source, prefix) => {
  const paths = [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
  return paths
    .filter((path) => path !== '/' && !path.includes(':') && path !== '*')
    .map((path) => `${prefix}${path}`);
};

const linksOf = (source) => new Set([...source.matchAll(/to="([^"]+)"/g)].map((m) => m[1]));

/**
 * Obrazovky, na které se schválně nechodí z menu. Každá výjimka musí mít důvod -
 * jinak je to zapomenutý odkaz, ne záměr.
 */
const VYJIMKY = {
  '/admin/register': 'zakládání dalšího správce je vzácná akce, chodí se na ni odkazem',
  '/admin/racers/slcr': 'podagenda Závodníků - otevírá se tlačítkem na obrazovce Závodníci, v menu být nemá',
};

describe('navigace administrace', () => {
  it('na každou routu vede odkaz z menu', () => {
    const routes = routesOf(read('components/admin/AdminRoutes.jsx'), '/admin');
    const links = linksOf(read('components/admin/AdminLayout.jsx'));

    const nedosazitelne = routes.filter((route) => !links.has(route) && !VYJIMKY[route]);

    expect(nedosazitelne, `Routy bez odkazu v menu: ${nedosazitelne.join(', ')}`).toEqual([]);
  });

  it('menu neodkazuje na routu, která neexistuje', () => {
    const routes = new Set(routesOf(read('components/admin/AdminRoutes.jsx'), '/admin'));
    const links = [...linksOf(read('components/admin/AdminLayout.jsx'))]
      .filter((link) => link.startsWith('/admin/'));

    const mrtve = links.filter((link) => !routes.has(link));

    expect(mrtve, `Odkazy v menu bez routy: ${mrtve.join(', ')}`).toEqual([]);
  });
});

describe('navigace časoměřiče', () => {
  it('na každou routu vede odkaz z menu', () => {
    const routes = routesOf(read('components/timekeeper/TimekeeperRoutes.jsx'), '/timekeeper');
    const links = linksOf(read('components/timekeeper/TimekeeperLayout.jsx'));

    const nedosazitelne = routes.filter((route) => !links.has(route) && !VYJIMKY[route]);

    expect(nedosazitelne, `Routy bez odkazu v menu: ${nedosazitelne.join(', ')}`).toEqual([]);
  });

  it('menu neodkazuje na routu, která neexistuje', () => {
    const routes = new Set(routesOf(read('components/timekeeper/TimekeeperRoutes.jsx'), '/timekeeper'));
    const links = [...linksOf(read('components/timekeeper/TimekeeperLayout.jsx'))]
      .filter((link) => link.startsWith('/timekeeper/'));

    const mrtve = links.filter((link) => !routes.has(link));

    expect(mrtve, `Odkazy v menu bez routy: ${mrtve.join(', ')}`).toEqual([]);
  });
});

describe('veřejná navigace', () => {
  it('menu neodkazuje na routu, která neexistuje', () => {
    const router = read('Router.jsx');
    const routes = new Set([...router.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]));
    const links = [...linksOf(read('components/layouts/Navigation.jsx'))]
      .filter((link) => link.startsWith('/') && !link.startsWith('/admin') && !link.startsWith('/timekeeper'));

    const mrtve = links.filter((link) => !routes.has(link));

    expect(mrtve, `Odkazy v menu bez routy: ${mrtve.join(', ')}`).toEqual([]);
  });
});
