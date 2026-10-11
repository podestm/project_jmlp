// Položky menu všech tří sekcí. Jediný zdroj pro nové rámce (SiteHeader,
// AdminSidebar, lišta časomíry) i pro test navigace (src/test/navigation.test.js),
// který hlídá, že na každou routu vede odkaz a žádný odkaz nevede do prázdna.
// Pořadí a názvy podle artboardů; `group: 'settings'` jde za oddělovač.
// Nová obrazovka = nová položka tady (nebo výjimka v testu s důvodem).

export const publicNav = [
  { to: '/', label: 'Úvod', icon: 'house' },
  { to: '/zavody', label: 'Závody', icon: 'calendar' },
  { to: '/archiv-zprav', label: 'Aktuality', icon: 'newspaper' },
  { to: '/dokumenty', label: 'Dokumenty', icon: 'file-text' },
  { to: '/kontakty', label: 'Kontakty', icon: 'mail' },
];

// Odznak ŽIVĚ vpravo v hlavičce (jen když se právě závodí).
export const publicLiveNav = { to: '/livetiming', label: 'Živě' };

export const adminNav = [
  { to: '/admin', label: 'Přehled', icon: 'gauge', end: true },
  { to: '/admin/races', label: 'Závody', icon: 'calendar' },
  { to: '/admin/racers', label: 'Závodníci', icon: 'user' },
  { to: '/admin/club-requests', label: 'Žádosti o kluby', icon: 'house' },
  { to: '/admin/documents', label: 'Dokumenty', icon: 'file-text' },
  { to: '/admin/posts', label: 'Aktuality', icon: 'newspaper' },
  { to: '/admin/seasons', label: 'Sezóny', icon: 'trophy', group: 'settings' },
  { to: '/admin/clubs', label: 'Kluby', icon: 'building', group: 'settings' },
  { to: '/admin/categories', label: 'Kategorie', icon: 'tag', group: 'settings' },
  { to: '/admin/register', label: 'Nový správce', icon: 'user-plus', group: 'settings' },
];

export const timekeeperNav = [
  { to: '/timekeeper', label: 'Přehled', end: true },
  { to: '/timekeeper/race-detail', label: 'Detail závodu' },
  { to: '/timekeeper/racers', label: 'Závodníci' },
  { to: '/timekeeper/start-list', label: 'Startovní listina' },
  { to: '/timekeeper/timing', label: 'Zadávání časů' },
  { to: '/timekeeper/results', label: 'Výsledky' },
  { to: '/timekeeper/race-numbers', label: 'Čísla', group: 'settings' },
  { to: '/timekeeper/sync', label: 'Synchronizace', group: 'settings' },
  { to: '/timekeeper/device', label: 'Zařízení', group: 'settings' },
];
