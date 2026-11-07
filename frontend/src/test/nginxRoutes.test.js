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

  it.each(['/tohle-neexistuje', '/zavod', '/wp-login.php', '/zavody/stara-stranka'])(
    '%s dostane 404',
    (path) => {
      expect(isSpaRoute(path)).toBe(false);
    },
  );
});

/** Regexy jedné mapy nginxu: [{ re, value }] v pořadí (vyhrává první shoda). */
const mapRules = (name) => {
  const block = nginx.match(new RegExp(`map \\S+ \\$${name} \\{([\\s\\S]*?)\\n\\}`))[1];
  return [...block.matchAll(/^\s*~(\*?)(\S+)\s+(.+?);$/gm)].map(
    ([, insensitive, pattern, value]) => ({
      re: new RegExp(pattern, insensitive ? 'i' : ''),
      value: value.replace(/"/g, ''),
    }),
  );
};
/** Hodnota mapy pro vstup; null = výchozí hodnota (žádný regex nesedí). */
const mapValue = (name, input) => mapRules(name).find(({ re }) => re.test(input))?.value ?? null;

describe('nginx: náhledy odkazů pro boty a robots', () => {
  it.each([
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'WhatsApp/2.23.20.0',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'Twitterbot/1.0',
  ])('%s je bot náhledu', (agent) => {
    expect(mapValue('jmlp_preview_bot', agent)).toBe('1');
  });

  it.each([
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  ])('%s náhled nedostane', (agent) => {
    expect(mapValue('jmlp_preview_bot', agent)).toBeNull();
  });

  it('náhled jen pro veřejné stránky botů', () => {
    expect(mapValue('jmlp_preview', '1/zavod/12')).toBe('1');
    expect(mapValue('jmlp_preview', '1/kontakty')).toBe('1');
    expect(mapValue('jmlp_preview', '1/admin/races')).toBe('0');
    expect(mapValue('jmlp_preview', '1/timekeeper')).toBe('0');
    expect(mapValue('jmlp_preview', '0/zavod/12')).toBeNull();
  });

  it('administrace a časomíra mají X-Robots-Tag noindex', () => {
    expect(mapValue('jmlp_robots_tag', '/admin')).toBe('noindex, nofollow');
    expect(mapValue('jmlp_robots_tag', '/timekeeper/timing?race=3')).toBe('noindex, nofollow');
    expect(mapValue('jmlp_robots_tag', '/zavody')).toBeNull();
    expect(mapValue('jmlp_robots_tag', '/administrace')).toBeNull();
  });

  it('robots.txt a sitemap.xml jdou na backend', () => {
    expect(nginx).toMatch(
      /location ~ \^\/\(robots\\\.txt\|sitemap\\\.xml\)\$ \{\s*proxy_pass http:\/\/\$backend_upstream;/,
    );
  });
});
