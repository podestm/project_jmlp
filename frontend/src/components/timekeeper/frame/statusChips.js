/**
 * Tři stavové odznaky časomíry (TkPrehled „Další stavy odznaků“): Spojení,
 * Fronta a Zařízení. Čisté funkce ze stavu fronty a sériového zařízení na
 * model odznaku, který kreslí StatusChip:
 *   { tone, icon, label, value, valueMono, detail: [{ text, mono }] }
 * tone: open (vše v pořádku) | amber (pozor) | dry (čeká) | calm (klid)
 *       | danger (musí zasáhnout člověk) | sending (odesílá se)
 * Stav nese vždy text, barva ho jen podtrhuje.
 */

const two = (n) => String(n).padStart(2, '0');
const clock = (date) => `${date.getHours()}:${two(date.getMinutes())}`;

/** Spojení se serverem: offline (od kdy) / odesílám / online. */
export const connectionChip = ({ syncState, offlineSince }) => {
  const base = { label: 'Spojení', valueMono: false };
  if (syncState === 'offline') {
    return {
      ...base,
      tone: 'amber',
      icon: 'wifi-off',
      value: 'Offline',
      detail: offlineSince ? [{ text: 'od' }, { text: clock(offlineSince), mono: true }] : [],
    };
  }
  if (syncState === 'syncing') {
    return { ...base, tone: 'sending', icon: 'sync', value: 'Odesílám', detail: [] };
  }
  return { ...base, tone: 'open', icon: 'wifi', value: 'Online', detail: [] };
};

/**
 * Fronta neodeslaných změn. Červeně jen to, co musí rozhodnout člověk
 * (vzdané, konflikt, chyba); čekající změny jsou jantarové.
 */
export const queueChip = (stats) => {
  const base = { label: 'Fronta', valueMono: true };
  if (stats.dead > 0) return { ...base, tone: 'danger', icon: 'ban', value: String(stats.dead), detail: [{ text: 'neodesláno' }] };
  if (stats.conflict > 0) return { ...base, tone: 'danger', icon: 'merge', value: String(stats.conflict), detail: [{ text: 'konflikt' }] };
  if (stats.failed > 0) return { ...base, tone: 'danger', icon: 'error', value: String(stats.failed), detail: [{ text: 'chyba odeslání' }] };
  if (stats.total > 0) return { ...base, tone: 'dry', icon: 'sync', value: String(stats.total), detail: [{ text: 'neodeslané' }] };
  return { ...base, tone: 'calm', icon: 'check', value: '0', detail: [{ text: 'vše na serveru' }] };
};

/** Sériové zařízení (časomíra na USB) z useSerialSession. */
export const deviceChip = ({ supported, canUse, connected, heldByOtherTab, baud, lockedBaud }) => {
  const base = { label: 'Zařízení', valueMono: false };
  if (!supported || !canUse) {
    return {
      ...base,
      tone: 'calm',
      icon: 'plug-off',
      value: 'Nejde',
      detail: [{ text: supported ? 'bez HTTPS' : 'v tomto prohlížeči' }],
    };
  }
  if (connected) {
    return {
      ...base,
      tone: 'open',
      icon: 'plug',
      value: 'Připojeno',
      detail: [{ text: String(lockedBaud || baud), mono: true }, { text: 'Bd' }],
    };
  }
  if (heldByOtherTab) {
    return { ...base, tone: 'amber', icon: 'plug', value: 'Jiná karta', detail: [{ text: 'čte jinde' }] };
  }
  return { ...base, tone: 'calm', icon: 'plug-off', value: 'Odpojeno', detail: [] };
};
