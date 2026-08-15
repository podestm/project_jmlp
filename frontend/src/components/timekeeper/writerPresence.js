// Otisk živých karet, které smějí zapisovat do inboxu.
//
// Bez něj by druhá otevřená karta vyhodnotila právě probíhající zápis té první
// jako osiřelý (začal přece dřív, než ona vznikla) a ohlásila přerušené
// ukládání, které se nepřerušilo.
//
// Všechny zápisy do localStorage jsou obalené: v anonymním režimu nebo při
// plné kvótě to hodí výjimku a zotavení pak jede jen podle stáří zápisu.
// Za závodu je to pořád lepší než spadlá obrazovka.

const WRITER_KEY_PREFIX = 'timekeeper_inbox_writer_';

/** Karta, která se déle neozvala, se považuje za mrtvou. */
const WRITER_ALIVE_MS = 9000;
export const WRITER_HEARTBEAT_MS = 3000;

/** Po téhle době se otisk uklidí úplně, ať se klíče nehromadí. */
const WRITER_FORGET_MS = 300000;

export const markWriterAlive = (writerId) => {
  try {
    localStorage.setItem(`${WRITER_KEY_PREFIX}${writerId}`, String(Date.now()));
  } catch {
    // viz komentář v hlavičce
  }
};

export const forgetWriter = (writerId) => {
  try {
    localStorage.removeItem(`${WRITER_KEY_PREFIX}${writerId}`);
  } catch {
    // viz komentář v hlavičce
  }
};

/** Id karet, které se ozvaly nedávno. Zastaralé otisky rovnou uklidí. */
export const liveWriterIds = () => {
  const alive = new Set();
  try {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(WRITER_KEY_PREFIX)) continue;
      const age = now - Number(localStorage.getItem(key));
      if (Number.isFinite(age) && age < WRITER_ALIVE_MS) {
        alive.add(key.slice(WRITER_KEY_PREFIX.length));
      } else if (!Number.isFinite(age) || age > WRITER_FORGET_MS) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // viz komentář v hlavičce
  }
  return alive;
};
