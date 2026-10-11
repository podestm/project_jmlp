import { ORGANIZER } from '../Contacts/contacts.js';

// Text stránky Ochrana osobních údajů (/ochrana-osobnich-udaju).
//
// Odstavec i položka seznamu je pole úseků: řetězec = text, todo(…) = místo,
// které musí pořadatel doplnit (na stránce svítí jako žlutý štítek „Doplnit“),
// link(…) = odkaz. Všechna místa k doplnění jsou tady, nikde jinde.

/** Místo k doplnění – na stránce jantarový štítek, aby se nedalo přehlédnout. */
const todo = (text) => ({ todo: text });
/** Odkaz: `to` v rámci webu, `href` ven. */
const link = (label, target) => ({ link: label, ...target });

const CONTROLLER_ADDRESS = `${ORGANIZER.street}, ${ORGANIZER.district}, ${ORGANIZER.city}`;

// Dotazy vyřizuje soutěžní výbor; jeho kontakty jsou jen na stránce Kontakty.
const CONTACTS = link('Kontakty', { to: '/kontakty#vybor' });

export const PRIVACY_INTRO = 'Jaké osobní údaje o závodnících a návštěvnících webu zpracováváme, proč, jak dlouho a jaká máte práva.';

export const PRIVACY_SECTIONS = [
  {
    id: 'spravce',
    title: 'Správce údajů',
    paragraphs: [
      [`Správcem osobních údajů je ${ORGANIZER.name}, IČO ${ORGANIZER.ico}, se sídlem ${CONTROLLER_ADDRESS}. `
        + 'Svaz je pobočným spolkem Svazu lyžařů České republiky z.s. (IČO 00537632).'],
      ['Jednotlivé závody poháru pořádají lyžařské kluby z pověření svazu.'],
      ['Dotazy k osobním údajům posílejte komukoli ze soutěžního výboru – kontakty najdete v sekci ', CONTACTS, '.'],
    ],
  },
  {
    id: 'udaje',
    title: 'Jaké údaje zpracováváme',
    paragraphs: [['U závodníků:']],
    list: [
      ['jméno, příjmení, ročník narození, pohlaví a klub;'],
      ['registrační číslo Svazu lyžařů ČR, pokud ho závodník má;'],
      ['u přihlášky volitelně telefon a e-mail na zákonného zástupce nebo jinou kontaktní osobu;'],
      ['účast na závodech, startovní čísla, časy, umístění a body.'],
    ],
    after: [
      ['U návštěvníků webu: IP adresu, typ prohlížeče a navštívenou stránku – jen pro statistiku návštěvnosti. '
        + 'Web nepoužívá sledovací cookies. V prohlížeči se ukládají jen technické údaje nutné pro jeho chod, '
        + 'například přihlášení správců a časoměřičů.'],
    ],
  },
  {
    id: 'ucel',
    title: 'Proč a na jakém základě',
    list: [
      ['Pořádání soutěže – přihlášky, startovní listiny, měření časů, vyhodnocení a zveřejnění výsledků. '
        + 'Základem je oprávněný zájem pořadatele i účastníků na férovém a dohledatelném vyhodnocení soutěže.'],
      ['Telefon a e-mail používáme jen ke komunikaci k závodu (změna programu, dotaz k přihlášce).'],
      ['Statistika návštěvnosti – oprávněný zájem na provozu a zlepšování webu.'],
    ],
  },
  {
    id: 'deti',
    title: 'Děti',
    paragraphs: [
      ['Většina závodníků jsou nezletilí. Přihlášku podává zákonný zástupce, nebo klub s jeho vědomím.'],
    ],
  },
  {
    id: 'zverejneni',
    title: 'Co zveřejňujeme',
    paragraphs: [
      ['Startovní listiny a výsledky – jméno, příjmení, ročník, klub, časy, umístění a body – jsou veřejně na tomto webu a v PDF. '
        + 'Jsou součástí historie poháru a jeho průběžného i celkového hodnocení. Telefon ani e-mail nezveřejňujeme.'],
    ],
  },
  {
    id: 'doba',
    title: 'Jak dlouho údaje uchováváme',
    list: [
      ['Výsledky a účast na závodech trvale, jako archiv soutěže. Kdo chce být v poháru hodnocen, nemůže své výsledky '
        + 'zpětně odstranit – jsou součástí zveřejněného celkového pořadí, i v PDF.'],
      ['Telefon a e-mail jen po dobu potřebnou pro sezónu: ', todo('DOPLNIT lhůtu, např. do konce sezóny'), '.'],
      ['Záznamy o návštěvnosti webu: ', todo('DOPLNIT lhůtu, navrhujeme 12 měsíců'), '.'],
    ],
  },
  {
    id: 'predani',
    title: 'Komu údaje předáváme',
    paragraphs: [
      ['Svazu lyžařů ČR, pokud jde o registrační čísla a výsledky: ', todo('DOPLNIT dle skutečnosti'), '. '
        + 'Jinak údaje nikomu dalšímu nepředáváme. Web běží na serverech v Evropské unii.'],
    ],
  },
  {
    id: 'prava',
    title: 'Vaše práva',
    paragraphs: [['Máte právo:']],
    list: [
      ['na přístup ke svým údajům a jejich opravu;'],
      ['na omezení zpracování a vznést námitku;'],
      ['na výmaz – s výjimkou zveřejněných výsledků, které zůstávají v archivu soutěže z oprávněného zájmu na úplném a dohledatelném hodnocení;'],
      ['podat stížnost u Úřadu pro ochranu osobních údajů (', link('www.uoou.gov.cz', { href: 'https://www.uoou.gov.cz' }), ').'],
    ],
    after: [['Své právo uplatníte e-mailem komukoli ze soutěžního výboru (sekce ', CONTACTS, ') nebo dopisem na adresu sídla správce.']],
  },
];

export const PRIVACY_EFFECTIVE = ['Tyto informace platí od ', todo('DOPLNIT datum účinnosti'), '.'];
