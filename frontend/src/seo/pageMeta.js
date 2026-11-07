// Titulky a popisy stránek pro vyhledávače a náhledy odkazů (Open Graph,
// Twitter). V prohlížeči je nastavuje usePageMeta; botům sociálních sítí, které
// JavaScript nespouštějí, posílá stejné texty backend (app/services/seo.py –
// při změně textů tady upravit i tam).
import { CUP_NAME } from '../components/site/siteInfo.js';
import { fixEncoding } from '../utils/text.js';

export const SHORT_NAME = 'JMLP';
export const OG_IMAGE = '/og-image.jpg';
export const DEFAULT_DESCRIPTION =
  'Seriál závodů v alpském lyžování pro děti a mládež na jižní Moravě. ' +
  'Kalendář závodů, přihlášky, živé výsledky a průběžné pořadí poháru.';

/** „Kontakty · Jihomoravský lyžařský pohár“; bez názvu jen jméno poháru. */
export const publicTitle = (name) => (name ? `${name} · ${CUP_NAME}` : CUP_NAME);
export const adminTitle = (name) =>
  name ? `${name} · Administrace ${SHORT_NAME}` : `Administrace ${SHORT_NAME}`;
export const timekeeperTitle = (name) =>
  name ? `${name} · Časomíra ${SHORT_NAME}` : `Časomíra ${SHORT_NAME}`;

/** Veřejné stránky; klíč = stránka v Routeru. */
export const PAGE_META = {
  home: { title: publicTitle(), description: DEFAULT_DESCRIPTION },
  races: {
    title: publicTitle('Kalendář závodů'),
    description:
      'Termíny a areály závodů Jihomoravského lyžařského poháru v aktuální sezóně, propozice a přihlášky závodníků.',
  },
  results: {
    title: publicTitle('Výsledky'),
    description:
      'Průběžné a celkové pořadí Jihomoravského lyžařského poháru podle kategorií a výsledkové listiny jednotlivých závodů.',
  },
  news: {
    title: publicTitle('Aktuality'),
    description:
      'Novinky a oznámení Jihomoravského lyžařského poháru: termíny, změny programu a zprávy ze závodů.',
  },
  documents: {
    title: publicTitle('Dokumenty'),
    description:
      'Soutěžní řád, pokyny a další dokumenty Jihomoravského lyžařského poháru ke stažení, včetně starších ročníků.',
  },
  contacts: {
    title: publicTitle('Kontakty'),
    description:
      'Soutěžní výbor Jihomoravského lyžařského poháru a e-mailové kontakty na zúčastněné kluby.',
  },
  live: {
    title: publicTitle('Živé výsledky'),
    description:
      'Průběžné časy a pořadí právě probíhajícího závodu Jihomoravského lyžařského poháru.',
  },
  privacy: {
    title: publicTitle('Ochrana osobních údajů'),
    description:
      'Jak pořadatel Jihomoravského lyžařského poháru zpracovává osobní údaje závodníků a návštěvníků webu.',
  },
  notFound: { title: publicTitle('Stránka nenalezena'), noindex: true },
};

/** Datum závodu „17. 1. 2027“ (null bez data). */
const raceDateLabel = (race) => {
  const [year, month, day] = String(race?.datum ?? '')
    .slice(0, 10)
    .split('-')
    .map(Number);
  return year && month && day ? `${day}. ${month}. ${year}` : null;
};

const knownName = (value, placeholder) => {
  const name = fixEncoding(value);
  return name && name !== placeholder ? name : null;
};

/**
 * Detail závodu: „Kraličák, 17. 1. 2027 · JMLP“ a věcný popis.
 * Stejný formát skládá backend pro boty (services/seo.py, race_meta).
 */
export const raceMeta = (race) => {
  const areal = knownName(race.areal_name, 'Bez areálu');
  const organizer = knownName(race.organizer_name, 'Neznámý organizátor');
  const date = raceDateLabel(race);
  const name = [areal ?? 'Závod', date].filter(Boolean).join(', ');
  const where = [areal && `v areálu ${areal}`, date && `dne ${date}`].filter(Boolean).join(' ');
  return {
    title: `${name} · ${SHORT_NAME}`,
    description:
      `Závod Jihomoravského lyžařského poháru${where ? ` ${where}` : ''}` +
      `${organizer ? `, pořádá ${organizer}` : ''}. Propozice, přihlášky a výsledky.`,
  };
};

// Značky v <head>, které stránka přepisuje: [atribut, klíč, hodnota z meta].
const TAGS = [
  ['name', 'description', (meta) => meta.description],
  ['name', 'robots', (meta) => (meta.noindex ? 'noindex, nofollow' : null)],
  ['property', 'og:title', (meta) => meta.title],
  ['property', 'og:description', (meta) => meta.description],
  ['property', 'og:url', (meta) => meta.url],
  ['property', 'og:image', (meta) => meta.image],
  ['name', 'twitter:title', (meta) => meta.title],
  ['name', 'twitter:description', (meta) => meta.description],
  ['name', 'twitter:image', (meta) => meta.image],
];

/** Nastaví (nebo smaže, když hodnota chybí) jednu <meta> v hlavičce. */
const setMeta = (doc, attribute, key, content) => {
  let tag = doc.head.querySelector(`meta[${attribute}="${key}"]`);
  if (content == null) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = doc.createElement('meta');
    tag.setAttribute(attribute, key);
    doc.head.append(tag);
  }
  tag.setAttribute('content', content);
};

/**
 * Zapíše titulek a meta značky stránky do dokumentu.
 * @param {{title: string, description?: string, noindex?: boolean}} meta
 * @param {{origin: string, pathname: string}} location - kvůli absolutním URL
 */
export const applyPageMeta = (meta, location, doc = document) => {
  const full = {
    description: DEFAULT_DESCRIPTION,
    ...meta,
    url: `${location.origin}${location.pathname}`,
    image: `${location.origin}${OG_IMAGE}`,
  };
  doc.title = full.title;
  TAGS.forEach(([attribute, key, value]) => setMeta(doc, attribute, key, value(full)));
};
