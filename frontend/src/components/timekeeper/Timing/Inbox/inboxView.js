// Schránka impulzů (TkZadavaniCasu, TkSchrankaImpulzuLog): čisté funkce, které
// z uložené události udělají to, co řádek a panel ukazují. O tom, komu se čas
// zapíše, tady nic nerozhoduje – to je resolveInboxEvent v inboxMatching.js.
import { czechPlural } from '../../../../utils/races.js';

/** Stavy, kdy řádek už nečeká na obsluhu (zapsáno, ukládá se, ve frontě, zamítnuto). */
const LOCKED_STATUSES = new Set(['saved', 'saving', 'queued', 'rejected']);

export const isLockedEvent = (event) => LOCKED_STATUSES.has(event.status);

/** Automaticky zapsaná událost má jedinou akci – Zamítnout, která vrátí kolo. */
export const isAutoWrittenEvent = (event) =>
  Boolean(event.auto_written) && (event.status === 'saved' || event.status === 'queued');

/**
 * Stav řádku slovy (barva ho jen podtrhuje).
 * tone: open (zapsáno) | navy (ve frontě, běží) | amber (rozhodnout) | danger | neutral
 */
export const eventStatus = (event, { candidateCount = 0, candidateIndex = -1 } = {}) => {
  const auto = isAutoWrittenEvent(event);
  switch (event.status) {
    case 'saved':
      return { tone: 'open', text: auto ? 'Zapsáno automaticky' : 'Potvrzeno ručně' };
    case 'queued':
      return { tone: 'open', text: auto ? 'Zapsáno automaticky' : 'Potvrzeno ručně' };
    case 'saving':
      return { tone: 'navy', text: 'Ukládám…' };
    case 'rejected':
      return { tone: 'neutral', text: 'Zamítnuto' };
    case 'save_failed':
      return { tone: 'danger', text: 'Neuloženo' };
    case 'warning':
      return { tone: 'amber', text: event.reason === 'unparsed' ? 'Nerozpoznáno' : 'Ke kontrole' };
    default:
      break;
  }
  if (event.reason === 'round_occupied') return { tone: 'amber', text: 'Kolo obsazené' };
  if (candidateCount > 1) {
    const shody = czechPlural(candidateCount, ['shoda', 'shody', 'shod']);
    return {
      tone: 'amber',
      text: `${candidateCount} ${shody} · ${Math.max(candidateIndex, 0) + 1}/${candidateCount}`,
    };
  }
  return { tone: 'amber', text: 'Čeká na potvrzení' };
};

/** Kam zapsaná událost došla: do fronty v notebooku, nebo do výsledků na serveru. */
export const eventDestination = (event) => {
  if (event.status === 'queued' || event.sync_op_id || event.sync_queue_id) return 've frontě';
  if (event.status === 'saved') return 've výsledcích';
  return null;
};

/**
 * Výjimky k rozhodnutí nahoru, zapsané a vyřízené pod ně. Pořadí uvnitř
 * skupin zůstává (nejnovější první, jak je drží IndexedDB).
 */
export const groupInboxEvents = (events) => {
  const decide = [];
  const done = [];
  events.forEach((event) => (isLockedEvent(event) ? done : decide).push(event));
  return { decide, done };
};

/** Souhrn pod přepínačem automatického zápisu: zapsáno samo · k rozhodnutí · zamítnuto. */
export const autoWriteSummary = (events) =>
  events.reduce(
    (acc, event) => {
      if (isAutoWrittenEvent(event)) acc.autoWritten += 1;
      else if (event.reason === 'auto_rejected') acc.rejected += 1;
      if (!isLockedEvent(event)) acc.toDecide += 1;
      return acc;
    },
    { autoWritten: 0, toDecide: 0, rejected: 0 },
  );
