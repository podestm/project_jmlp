import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ICONS } from '../components/ms/Icon/icons.js';
import {
  adminNav, publicFooterColumns, publicFooterLinks, publicLiveNav, publicNav, timekeeperNav,
} from '../components/ms/navItems.js';

/**
 * Na každou obrazovku musí vést odkaz z menu.
 *
 * Vzniklo po konkrétní ztrátě: routy /admin/clubs (správa klubů a jejich log)
 * a /timekeeper/race-detail (údaje závodu do hlavičky výsledkové listiny)
 * existovaly, komponenty existovaly, build i testy procházely - jen na ně
 * nevedl žádný odkaz, takže z pohledu obsluhy ty funkce prostě zmizely.
 *
 * Menu se čtou z dat (components/ms/navItems.js), routy doslovně z <Route
 * path="…">. Dokud starý rámec navItems nepoužívá, musí jeho odkazy s daty
 * souhlasit - jinak by data mohla tiše zastarat a test procházet naprázdno.
 * Nový rámec veřejného webu (SiteHeader, MobileMenu, SiteFooter) data čte.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

const read = (relative) => readFileSync(join(SRC, relative), 'utf8');

const routesOf = (source, prefix) => {
  const paths = [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
  return paths
    .filter((path) => path !== '*' && !path.includes(':'))
    .map((path) => (path === '/' ? prefix || '/' : `${prefix}${path}`));
};

/** Odkazy ve starém rámci: to="…" i položky pole { path: '…' }. */
const legacyLinksOf = (source) => new Set([
  ...[...source.matchAll(/\bto="([^"]+)"/g)].map((m) => m[1]),
  ...[...source.matchAll(/\bpath:\s*'([^']+)'/g)].map((m) => m[1]),
]);

/**
 * Obrazovky, na které se schválně nechodí z menu. Každá výjimka musí mít důvod -
 * jinak je to zapomenutý odkaz, ne záměr.
 */
const VYJIMKY = {
  '/admin/racers/slcr': 'podagenda Závodníků - otevírá se tlačítkem na obrazovce Závodníci, v menu být nemá',
  '/__ms': 'katalog kitu Modré stopy, jen v dev buildu',
  '/archiv-zprav': 'stará adresa, přesměruje na /aktuality',
  '/livetiming': 'stará adresa, přesměruje na /zive',
  '/registrace': 'stará adresa, přesměruje na /zavody (přihláška je u závodu)',
};

const SECTIONS = [
  {
    name: 'administrace',
    items: adminNav,
    routes: () => routesOf(read('components/admin/AdminRoutes.jsx'), '/admin'),
    layout: 'components/admin/frame/AdminNav/AdminNav.jsx',
    prefix: '/admin',
  },
  {
    name: 'časoměřiče',
    items: timekeeperNav,
    routes: () => routesOf(read('components/timekeeper/TimekeeperRoutes.jsx'), '/timekeeper'),
    layout: 'components/timekeeper/frame/TabBar/TabBar.jsx',
    prefix: '/timekeeper',
  },
];

describe.each(SECTIONS)('navigace $name', ({ items, routes, layout, prefix }) => {
  const links = new Set(items.map((item) => item.to));

  it('na každou routu vede odkaz z menu', () => {
    const nedosazitelne = routes().filter((route) => !links.has(route) && !VYJIMKY[route]);
    expect(nedosazitelne, `Routy bez odkazu v menu: ${nedosazitelne.join(', ')}`).toEqual([]);
  });

  it('menu neodkazuje na routu, která neexistuje', () => {
    const existing = new Set(routes());
    const mrtve = [...links].filter((link) => !existing.has(link));
    expect(mrtve, `Odkazy v menu bez routy: ${mrtve.join(', ')}`).toEqual([]);
  });

  it('starý rámec, dokud nečte navItems, má stejné odkazy', () => {
    const source = read(layout);
    if (source.includes('navItems')) return;
    const legacy = [...legacyLinksOf(source)].filter((link) => link === prefix || link.startsWith(`${prefix}/`));
    expect(new Set(legacy)).toEqual(links);
  });
});

describe('veřejná navigace', () => {
  const routes = () => routesOf(read('Router.jsx'), '')
    .filter((route) => !route.startsWith('/admin') && !route.startsWith('/timekeeper'));
  const menuLinks = [...publicNav, publicLiveNav].map((item) => item.to);
  const footerLinks = [...publicFooterLinks, ...publicFooterColumns.flatMap((column) => column.links)]
    .map((item) => item.to);

  it('na každou routu vede odkaz z menu', () => {
    const links = new Set(menuLinks);
    const nedosazitelne = routes().filter((route) => !links.has(route) && !VYJIMKY[route]);
    expect(nedosazitelne, `Routy bez odkazu v menu: ${nedosazitelne.join(', ')}`).toEqual([]);
  });

  it('menu ani patička neodkazují na routu, která neexistuje', () => {
    const existing = new Set(routes());
    const mrtve = [...menuLinks, ...footerLinks].filter((link) => !existing.has(link));
    expect(mrtve, `Odkazy bez routy: ${mrtve.join(', ')}`).toEqual([]);
  });

  it.each([
    'components/site/SiteHeader/SiteHeader.jsx',
    'components/site/MobileMenu/MobileMenu.jsx',
    'components/site/SiteFooter/SiteFooter.jsx',
    'components/timekeeper/frame/TabBar/TabBar.jsx',
    'components/admin/frame/AdminNav/AdminNav.jsx',
  ])('%s čte odkazy z navItems', (file) => {
    expect(read(file)).toContain('navItems');
  });
});

describe('položky menu', () => {
  it.each([...publicNav, ...adminNav, ...timekeeperNav].filter((item) => item.icon))('$to má ikonu z registru kitu', (item) => {
    expect(ICONS[item.icon]).toBeTruthy();
  });
});
