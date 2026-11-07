import { afterEach, describe, expect, it } from 'vitest';
import {
  adminTitle,
  applyPageMeta,
  PAGE_META,
  publicTitle,
  raceMeta,
  timekeeperTitle,
} from './pageMeta.js';

const LOCATION = { origin: 'https://jmlp.cz', pathname: '/kontakty' };
const meta = (selector) =>
  document.head.querySelector(`meta[${selector}]`)?.getAttribute('content');

afterEach(() => {
  document.head.innerHTML = '';
});

describe('pageMeta', () => {
  it('titulky sekcí', () => {
    expect(publicTitle('Kontakty')).toBe('Kontakty · Jihomoravský lyžařský pohár');
    expect(publicTitle()).toBe('Jihomoravský lyžařský pohár');
    expect(adminTitle('Závody')).toBe('Závody · Administrace JMLP');
    expect(timekeeperTitle()).toBe('Časomíra JMLP');
  });

  it('závod: areál a datum, bez areálu obecně', () => {
    expect(
      raceMeta({
        areal_name: 'Kraličák',
        datum: '2027-01-17',
        organizer_name: 'Neznámý organizátor',
      }),
    ).toEqual({
      title: 'Kraličák, 17. 1. 2027 · JMLP',
      description:
        'Závod Jihomoravského lyžařského poháru v areálu Kraličák dne 17. 1. 2027. Propozice, přihlášky a výsledky.',
    });
    expect(raceMeta({ areal_name: 'Bez areálu', datum: null }).title).toBe('Závod · JMLP');
  });

  it('zapíše titulek, popis, Open Graph s absolutní adresou a robots jen u noindex', () => {
    applyPageMeta(PAGE_META.contacts, LOCATION);
    expect(document.title).toBe('Kontakty · Jihomoravský lyžařský pohár');
    expect(meta('name="description"')).toBe(PAGE_META.contacts.description);
    expect(meta('property="og:url"')).toBe('https://jmlp.cz/kontakty');
    expect(meta('property="og:image"')).toBe('https://jmlp.cz/og-image.jpg');
    expect(meta('name="twitter:title"')).toBe(PAGE_META.contacts.title);
    expect(meta('name="robots"')).toBeUndefined();

    applyPageMeta({ title: adminTitle('Závody'), noindex: true }, LOCATION);
    expect(meta('name="robots"')).toBe('noindex, nofollow');
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);

    applyPageMeta(PAGE_META.home, LOCATION);
    expect(meta('name="robots"')).toBeUndefined();
  });
});
