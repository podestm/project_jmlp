/**
 * Čisté funkce pro evidenci SLČR (backend routers/timekeeper/slcr.py):
 * texty, popisky plánu závodů a pamatování akce u závodu.
 */

/** Disciplína, když backend seznam nepošle (Trénink). */
export const FALLBACK_DISCIPLINES = [{ id: 26, name: 'Trénink' }];
export const DEFAULT_DISCIPLINE = 26;

/** Co se u kategorie v akci stane: text štítku, tón a stav řádku. */
export const PLAN_ACTIONS = {
  create: { label: 'Založí se', tone: 'navy' },
  codex: { label: 'Doplní se kodex', tone: 'dry', state: 'warning' },
  keep: { label: 'Už je v akci', tone: 'open', state: 'muted' },
};

const SEX_LABELS = { Male: 'Muži', Female: 'Ženy', Both: 'Společná' };

/** Text chyby od backendu (detail), ne obecné „API Error: 502“. */
export const slcrErrorText = (err) => (typeof err?.detail === 'string' && err.detail) || err?.message || 'Neznámá chyba';

/** „2026-01-17“ → „17. 1. 2026“ (bez převodu časových pásem). */
export const formatSlcrDate = (value) => {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return day ? `${Number(day)}. ${Number(month)}. ${year}` : String(value);
};

/** „09:30:00“ → „9:30“. */
export const formatStartTime = (value) => {
  const [hours, minutes] = String(value || '').split(':');
  return minutes ? `${Number(hours)}:${minutes}` : '';
};

/** Co chybí v .env backendu; prázdné pole = SLČR je nastavené. */
export const configProblems = (status) => {
  if (!status) return [];
  const problems = [];
  if (!status.token) problems.push('token časomíry (SLCR_API_TOKEN)');
  if (!status.login) problems.push('přihlášení do evidence (SLCR_USERNAME, SLCR_PASSWORD)');
  return problems;
};

/** Řádek náhledu: u zakládaných kategorií i pohlaví a ročníky z evidence. */
export const planRow = (item) => {
  const manual = item.input?.category?.manual;
  const years = manual ? [manual.yearFrom, manual.yearTo].filter((year) => year != null) : [];
  return {
    id: item.category_id,
    name: item.name,
    codex: String(item.input?.codex ?? item.category_id),
    sex: manual ? SEX_LABELS[manual.sex] || manual.sex : '',
    years: [...new Set(years)].join('–'),
    slcrName: item.slcr_name && item.slcr_name !== item.name ? item.slcr_name : '',
    action: PLAN_ACTIONS[item.action] ? item.action : 'keep',
  };
};

/** Souhrn náhledu pro tlačítka a stav kroků. */
export const planSummary = (plan) => {
  const items = plan?.items || [];
  const count = (action) => items.filter((item) => item.action === action).length;
  const created = items.find((item) => item.action === 'create')?.input;
  return {
    total: items.length,
    toCreate: count('create'),
    toCodex: count('codex'),
    changes: items.length - count('keep'),
    manual: plan?.event?.category_mode === 'Manual',
    startTime: formatStartTime(created?.startTime),
  };
};

export const createdMessage = (data) => {
  const parts = [];
  if (data?.created) parts.push(`založeno ${data.created} závodů`);
  if (data?.codex_filled) parts.push(`doplněn kodex u ${data.codex_filled}`);
  return parts.length ? `Hotovo: ${parts.join(', ')}.` : 'Všechny závody už v akci jsou.';
};

/** Potvrzení před zápisem do evidence – závody i výsledky jdou do ostré evidence SLČR. */
export const createConfirm = (plan, summary) => ({
  title: 'Založit závody v evidenci SLČR?',
  message: [
    `V akci „${plan?.event?.name || 'vybraná akce'}“ se `,
    [summary.toCreate && `založí ${summary.toCreate} závodů`, summary.toCodex && `u ${summary.toCodex} se doplní kodex`]
      .filter(Boolean).join(' a '),
    '. Zápis jde rovnou do evidence SLČR.',
  ].join(''),
  confirmLabel: 'Založit závody',
});

export const sendConfirm = (eventName) => ({
  title: 'Odeslat výsledky do evidence SLČR?',
  message: `Výsledky všech kategorií se pošlou do akce „${eventName || 'vybraná akce'}“. V evidenci zůstanou nezveřejněné – zveřejňují se až tam.`,
  confirmLabel: 'Odeslat výsledky',
});

export const sentMessage = (data) => {
  const note = data?.unfinished ? ` ${data.unfinished} startujících bez času a bez příznaku se neposlalo.` : '';
  return `Výsledky jsou v evidenci (zatím nezveřejněné – zveřejňuje se v evidenci).${note}`;
};

/*
 * Akce a disciplína se pamatují v prohlížeči pro každý závod zvlášť, aby se
 * výsledky po závodě posílaly do stejné akce, kde se ráno zakládaly závody.
 */
const storageKey = (raceId) => `slcr_event_${raceId}`;

export const readSlcrChoice = (raceId) => {
  try {
    return JSON.parse(localStorage.getItem(storageKey(raceId)) || '{}') || {};
  } catch {
    return {};
  }
};

export const storeSlcrChoice = (raceId, { eventId, discipline }) => {
  try {
    localStorage.setItem(storageKey(raceId), JSON.stringify({
      eventId: Number(eventId) || null,
      discipline: Number(discipline),
    }));
  } catch {
    // Bez úložiště se jen nic nepamatuje.
  }
};
