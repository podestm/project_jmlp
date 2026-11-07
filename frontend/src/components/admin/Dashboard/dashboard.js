// Čisté funkce přehledu administrace (texty, data, popisky stránek).

// Staré adresy zůstávají kvůli návštěvám z doby před redesignem.
const PATH_LABELS = {
  '/': 'Úvod',
  '/zavody': 'Závody',
  '/vysledky': 'Výsledky',
  '/aktuality': 'Aktuality',
  '/archiv-zprav': 'Archiv zpráv',
  '/dokumenty': 'Dokumenty',
  '/kontakty': 'Kontakty',
  '/zive': 'Živě',
};

/** Popisek navštívené stránky; neznámá adresa zůstane adresou. */
export const pathLabel = (path) => {
  if (PATH_LABELS[path]) return PATH_LABELS[path];
  const race = path.match(/^\/zavod\/(\d+)$/);
  return race ? `Detail závodu ${race[1]}` : path;
};

/** „den“ / „dny“ / „dní“ podle počtu. */
export const daysWord = (n) => {
  if (n === 1) return 'den';
  if (n >= 2 && n <= 4) return 'dny';
  return 'dní';
};

const sameDay = (a, b) => a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Kdy se kdo přihlásil, krátce: { day: 'dnes' | 'včera' | '12. 10.', time: '18:47' }.
 * Bez data { day: '—', time: '' }.
 */
export const whenParts = (iso, now = new Date()) => {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return { day: '—', time: '' };
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  let day = `${date.getDate()}. ${date.getMonth() + 1}.`;
  if (sameDay(date, now)) day = 'dnes';
  else if (sameDay(date, yesterday)) day = 'včera';
  const time = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  return { day, time };
};

/** Dnešní datum do záhlaví: „středa 23. září 2026“. */
export const todayLabel = (now = new Date()) => now.toLocaleDateString('cs-CZ', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

/** Číslo s mezerou po tisících („1 284“); chybějící hodnota jako pomlčka. */
export const formatCount = (value) => (value === null || value === undefined ? '—' : value.toLocaleString('cs-CZ'));
