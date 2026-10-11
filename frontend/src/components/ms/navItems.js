// Položky menu všech tří sekcí. Jediný zdroj pro nové rámce (SiteHeader,
// AdminSidebar, lišta časomíry) i pro test navigace (src/test/navigation.test.js),
// který hlídá, že na každou routu vede odkaz a žádný odkaz nevede do prázdna.
// Pořadí, názvy a ikony podle artboardů (veřejná hlavička je bez ikon);
// `group: 'settings'` jde za oddělovač.
// Nová obrazovka = nová položka tady (nebo výjimka v testu s důvodem).

// `hint` je druhý řádek v mobilním menu (MobilMenu), `alsoActive` prefixy
// dalších adres, kde je položka aktivní (detail závodu patří pod Závody).
export const publicNav = [
  { to: '/', label: 'Úvod', end: true },
  { to: '/zavody', label: 'Závody', hint: 'Kalendář sezóny', alsoActive: ['/zavod/'] },
  { to: '/vysledky', label: 'Výsledky', hint: 'Průběžné výsledky a listiny' },
  { to: '/aktuality', label: 'Aktuality' },
  { to: '/dokumenty', label: 'Dokumenty' },
  { to: '/kontakty', label: 'Kontakty' },
];

// Odznak ŽIVĚ vpravo v hlavičce – vidět je vždy, při závodě červený.
export const publicLiveNav = { to: '/zive', label: 'Živě' };

// Velká patička úvodu (Main): dva sloupce odkazů.
export const publicFooterColumns = [
  {
    title: 'Web',
    links: [
      { to: '/zavody', label: 'Kalendář závodů' },
      { to: '/vysledky', label: 'Výsledky a pořadí' },
      { to: '/zive', label: 'Živé výsledky' },
    ],
  },
  {
    title: 'Pohár',
    links: [
      { to: '/dokumenty', label: 'Soutěžní řád' },
      { to: '/kontakty', label: 'Kontakty na kluby' },
    ],
  },
];

// Úzká patička ostatních stránek (Zavody): odkazy vpravo.
export const publicFooterLinks = [
  { to: '/kontakty', label: 'Kontakty' },
  { to: '/dokumenty', label: 'Dokumenty' },
];

export const adminNav = [
  { to: '/admin', label: 'Přehled', icon: 'dashboard', end: true },
  { to: '/admin/races', label: 'Závody', icon: 'calendar' },
  { to: '/admin/racers', label: 'Závodníci', icon: 'user' },
  { to: '/admin/club-requests', label: 'Žádosti o kluby', icon: 'home' },
  { to: '/admin/documents', label: 'Dokumenty', icon: 'file' },
  { to: '/admin/posts', label: 'Aktuality', icon: 'news' },
  { to: '/admin/seasons', label: 'Sezóny', icon: 'trophy', group: 'settings' },
  { to: '/admin/clubs', label: 'Kluby', icon: 'building', group: 'settings' },
  { to: '/admin/categories', label: 'Kategorie', icon: 'tag', group: 'settings' },
  { to: '/admin/register', label: 'Nový správce', icon: 'user-plus', group: 'settings' },
];

// Časomíra v pořadí závodního dne (TkPrehled), za oddělovačem obecné
// nastavení nevázané k závodu. Ikony jsou pro lištu pod 1280 px a mobilní menu.
export const timekeeperNav = [
  { to: '/timekeeper', label: 'Přehled', icon: 'dashboard', end: true },
  { to: '/timekeeper/race-detail', label: 'Detail závodu', icon: 'card' },
  { to: '/timekeeper/racers', label: 'Závodníci', icon: 'user-plus' },
  { to: '/timekeeper/start-list', label: 'Startovní listina', icon: 'list' },
  { to: '/timekeeper/timing', label: 'Zadávání časů', icon: 'stopwatch' },
  { to: '/timekeeper/results', label: 'Výsledky', icon: 'trophy' },
  { to: '/timekeeper/race-numbers', label: 'Čísla', icon: 'numbers', group: 'settings' },
  { to: '/timekeeper/sync', label: 'Synchronizace', icon: 'sync', group: 'settings' },
  { to: '/timekeeper/device', label: 'Zařízení', icon: 'plug', group: 'settings' },
];

/** Je položka menu aktivní na dané adrese? `end` = jen přesná shoda (Úvod). */
export const isNavActive = (item, pathname) => {
  if (pathname === item.to) return true;
  if (item.end) return false;
  return pathname.startsWith(`${item.to}/`)
    || (item.alsoActive || []).some((prefix) => pathname.startsWith(prefix));
};
