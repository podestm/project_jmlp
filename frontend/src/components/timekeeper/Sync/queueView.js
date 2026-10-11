// Synchronizace (TkSynchronizace): čisté funkce, které z položky offline
// fronty a konfliktu udělají text pro obsluhu. Fronta sama je v offline/syncQueue.js.

/** Stav položky fronty slovy; tone podtrhuje barvou. */
export const QUEUE_STATUS = {
  pending: { tone: 'navy', icon: 'clock', text: 'Ve frontě' },
  processing: { tone: 'navy', icon: 'sync', text: 'Odesílá se' },
  done: { tone: 'open', icon: 'check', text: 'Na serveru' },
  failed: { tone: 'amber', icon: 'warning', text: 'Chyba – zkusí znovu' },
  conflict: { tone: 'amber', icon: 'merge', text: 'Konflikt' },
  dead: { tone: 'danger', icon: 'ban', text: 'Neodesláno' },
  superseded: { tone: 'neutral', icon: 'arrow-right', text: 'Nahrazeno novějším' },
  dropped: { tone: 'neutral', icon: 'close', text: 'Zahozeno ručně' },
};

export const queueStatus = (status) => QUEUE_STATUS[status] || { tone: 'neutral', icon: 'info', text: status || '—' };

const TIME_ENDPOINT = /\/start-list\/(\d+)\/time$/;
const BULK_ENDPOINT = /\/races\/\d+\/times$/;
const EXCLUDED_ENDPOINT = /\/start-list\/(\d+)\/excluded$/;

const present = (value) => value !== null && value !== undefined && value !== '';

/** „Kolo 1 34.07 · DNF“ z hodnot jednoho zápisu času. */
export const describeTimes = (values = {}) => {
  const parts = [];
  if (present(values.time1)) parts.push(`kolo 1 ${values.time1}`);
  if (present(values.time2)) parts.push(`kolo 2 ${values.time2}`);
  ['dnf', 'dns', 'dsq'].forEach((flag) => { if (values[flag]) parts.push(flag.toUpperCase()); });
  return parts.length ? parts.join(' · ') : 'bez času a příznaku';
};

/**
 * Co položka fronty nese, česky: zápis času jednoho záznamu, Uložit vše,
 * vyřazení ze startovky, nebo surová metoda a adresa.
 */
export const describeQueueItem = (item) => {
  const endpoint = item?.endpoint || '';
  const payload = item?.payload || {};
  let match = TIME_ENDPOINT.exec(endpoint);
  if (match) return `Záznam #${match[1]}: ${describeTimes(payload)}`;
  if (BULK_ENDPOINT.test(endpoint)) {
    const count = Array.isArray(payload.entries) ? payload.entries.length : 0;
    return `Uložit vše – ${count} záznamů`;
  }
  match = EXCLUDED_ENDPOINT.exec(endpoint);
  if (match) return `Záznam #${match[1]}: ${payload.excluded ? 'vyřazení ze startovky' : 'návrat na startovku'}`;
  return `${item?.method || ''} ${endpoint}`.trim();
};

/** Hodnoty pole v srovnání konfliktu: Ano/Ne, pomlčka. */
export const formatConflictField = (value) => {
  if (!present(value)) return '—';
  if (typeof value === 'boolean') return value ? 'Ano' : 'Ne';
  return String(value);
};

/** Lokální hodnoty konfliktního záznamu (u Uložit vše jen ten jeden záznam). */
export const localConflictEntry = (conflict) => {
  const payload = conflict?.payload || {};
  const entryId = conflict?.conflict_detail?.entry_id;
  if (Array.isArray(payload.entries)) {
    return payload.entries.find((entry) => Number(entry?.entry_id) === Number(entryId)) || null;
  }
  return payload;
};

export const CONFLICT_FIELDS = [
  ['time1', 'Kolo 1'],
  ['time2', 'Kolo 2'],
  ['dnf', 'DNF'],
  ['dns', 'DNS'],
  ['dsq', 'DSQ'],
];

/** Zápis zaparkovaný na vypršelém tokenu (AUTH_EXPIRED_MESSAGE v offline/sync.js). */
const AUTH_EXPIRED_PREFIX = 'Přihlášení vypršelo';

export const isAuthExpired = (items) => items.some((item) => (
  item.status === 'pending'
  && typeof item.last_error === 'string'
  && item.last_error.startsWith(AUTH_EXPIRED_PREFIX)
));
