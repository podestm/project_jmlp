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
  skip: { label: 'Nezaloží se', tone: 'neutral', state: 'muted' },
};

/** Trvalé upozornění, když backend běží se SLCR_DRY_RUN=1. */
export const DRY_RUN_TEXT = 'Zkušební režim – do evidence SLČR se nic neposílá';

const SEX_LABELS = { Male: 'Muži', Female: 'Ženy', Both: 'Společná' };

/** Text chyby od backendu (detail), ne obecné „API Error: 502“. */
export const slcrErrorText = (err) =>
  (typeof err?.detail === 'string' && err.detail) || err?.message || 'Neznámá chyba';

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
    reason: item.reason || '',
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
    kept: count('keep'),
    skipped: count('skip'),
    changes: count('create') + count('codex'),
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
    [
      summary.toCreate && `založí ${summary.toCreate} závodů`,
      summary.toCodex && `u ${summary.toCodex} se doplní kodex`,
    ]
      .filter(Boolean)
      .join(' a '),
    '. Zápis jde rovnou do evidence SLČR.',
    dryRunNote(summary.dryRun),
  ].join(''),
  confirmLabel: 'Založit závody',
});

const dryRunNote = (dryRun) => (dryRun ? ` ${DRY_RUN_TEXT}.` : '');

export const sendConfirm = (eventName, dryRun) => ({
  title: 'Odeslat výsledky do evidence SLČR?',
  message: `Výsledky všech kategorií se pošlou do akce „${eventName || 'vybraná akce'}“. V evidenci zůstanou nezveřejněné – zveřejňují se až tam.${dryRunNote(dryRun)}`,
  confirmLabel: 'Odeslat výsledky',
});

export const sentMessage = (data) => {
  const note = data?.unfinished
    ? ` ${data.unfinished} startujících bez času a bez příznaku se neposlalo.`
    : '';
  return `Výsledky jsou v evidenci (zatím nezveřejněné – zveřejňuje se v evidenci).${note}`;
};

/*
 * Výsledky po kategoriích (backend GET/POST .../slcr/categories): každá
 * kategorie je v akci vlastní závod, posílá se a zveřejňuje zvlášť.
 */

/** Stav výsledků kategorie v evidenci (ResultRaceState) slovy. */
export const CATEGORY_STATES = {
  none: { label: 'Neodesláno', tone: 'neutral' },
  Draft: { label: 'V evidenci, nezveřejněno', tone: 'dry' },
  Checked: { label: 'Zkontrolováno, nezveřejněno', tone: 'dry' },
  Published: { label: 'Zveřejněno', tone: 'open' },
  Canceled: { label: 'Zrušeno v evidenci', tone: 'closed' },
  Hidden: { label: 'Skryto v evidenci', tone: 'closed' },
};

/** ISO čas → „14:05“ v místním čase. */
export const formatClock = (value) => {
  const time = value ? new Date(value) : null;
  if (!time || Number.isNaN(time.getTime())) return '';
  return `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;
};

/** Štítek stavu: „Zveřejněno v 14:05“, „Neodesláno“… */
export const categoryState = (item) => {
  const key = CATEGORY_STATES[item?.slcr_state] ? item.slcr_state : 'none';
  const { label, tone } = CATEGORY_STATES[key];
  const clock = key === 'Published' ? formatClock(item?.published_at) : '';
  return { key, tone, label: clock ? `${label} v ${clock}` : label };
};

/** Startující bez času i bez DNF/DNS/DSQ – takovou kategorii nejde poslat. */
export const missingCount = (entries = []) =>
  entries.filter((entry) => entry.time_sum == null && !entry.status).length;

/** „1 závodník“, „3 závodníci“, „5 závodníků“. */
export const racersText = (count) => {
  if (count === 1) return '1 závodník';
  if (count >= 2 && count <= 4) return `${count} závodníci`;
  return `${count} závodníků`;
};

/** Značka u čipu kategorie: zveřejněné a rozpracované v evidenci. */
export const chipMark = (item) => {
  if (item?.slcr_state === 'Published')
    return { icon: 'check', label: 'zveřejněno v SLČR', tone: 'done' };
  if (item?.slcr_state === 'Draft' || item?.slcr_state === 'Checked') {
    return { icon: 'clock', label: 'v SLČR nezveřejněno', tone: 'pending' };
  }
  return null;
};

export const publishConfirm = ({ categoryName, eventName, correction, dryRun }) => ({
  title: correction
    ? `Opravit výsledky kategorie ${categoryName} v SLČR?`
    : `Zveřejnit kategorii ${categoryName} v SLČR?`,
  message: [
    `Výsledky kategorie „${categoryName}“ se pošlou do akce „${eventName || 'vybraná akce'}“ a hned se zveřejní.`,
    correction && ' Dosud zveřejněné výsledky kategorie se nahradí novými.',
    dryRunNote(dryRun),
  ]
    .filter(Boolean)
    .join(''),
  confirmLabel: correction ? 'Opravit v SLČR' : 'Odeslat a zveřejnit',
});

export const publishedMessage = (categoryName, data) => {
  const done = data?.corrected ? 'je v SLČR opravená a znovu zveřejněná' : 'je v SLČR zveřejněná';
  return `Kategorie ${categoryName} ${done}.${data?.dry_run ? ' (zkušební režim – nic se neodeslalo)' : ''}`;
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
    localStorage.setItem(
      storageKey(raceId),
      JSON.stringify({
        eventId: Number(eventId) || null,
        discipline: Number(discipline),
      }),
    );
  } catch {
    // Bez úložiště se jen nic nepamatuje.
  }
};
