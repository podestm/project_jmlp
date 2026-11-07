import { useEffect, useState } from 'react';
import { TimekeeperAPI } from '../../../../config/timekeeperApi.js';
import {
  DEFAULT_DISCIPLINE,
  configProblems,
  createConfirm,
  createdMessage,
  planSummary,
  readSlcrChoice,
  sendConfirm,
  sentMessage,
  slcrErrorText,
  storeSlcrChoice,
} from './slcr.js';

/**
 * Evidence SLČR u závodu (dříve SlcrModal): stav nastavení, akce kolem data
 * závodu, náhled a založení závodů po kategoriích, odeslání výsledků.
 * Volá jen TimekeeperAPI.getOnline/postOnline – bez keše a bez fronty, aby se
 * odložené zakládání závodů nemohlo provést dvakrát.
 *
 * Kroky: 1 akce a disciplína → náhled, 2 založení závodů, 3 výsledky.
 */
export function useSlcrEvidence({ raceId, hasResults, confirm }) {
  const [stored] = useState(() => readSlcrChoice(raceId));
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState(null);
  const [eventsError, setEventsError] = useState(null);
  const [eventId, setEventIdState] = useState(stored.eventId ? String(stored.eventId) : '');
  const [discipline, setDisciplineState] = useState(stored.discipline || DEFAULT_DISCIPLINE);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(null);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState(null);

  // Stav nastavení; akce se načítají jen s tokenem (bez něj by jen selhaly).
  useEffect(() => {
    let cancelled = false;
    TimekeeperAPI.getOnline('/api/timekeeper/slcr/status')
      .then((data) => {
        if (cancelled) return null;
        setStatus(data);
        if (!data?.token) return null;
        return TimekeeperAPI.getOnline(`/api/timekeeper/races/${raceId}/slcr/events`)
          .then((list) => {
            if (!cancelled) setEvents(Array.isArray(list) ? list : []);
          })
          .catch((err) => {
            if (!cancelled) setEventsError(slcrErrorText(err));
          });
      })
      .catch((err) => {
        if (!cancelled) setMessage({ type: 'danger', text: slcrErrorText(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [raceId]);

  // Jiná akce nebo disciplína = starý náhled neplatí.
  const setEventId = (value) => {
    setEventIdState(String(value).replace(/\D/g, ''));
    setPlan(null);
    setSent(false);
  };
  const setDiscipline = (value) => {
    setDisciplineState(Number(value));
    setPlan(null);
    setSent(false);
  };

  const run = async (kind, action) => {
    setBusy(kind);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      if (kind === 'plan') setPlan(null);
      setMessage({ type: 'danger', text: slcrErrorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const body = () => ({ event_id: Number(eventId), discipline: Number(discipline) });

  const loadPlan = () =>
    run('plan', async () => {
      const data = await TimekeeperAPI.getOnline(`/api/timekeeper/races/${raceId}/slcr/plan`, {
        event_id: eventId,
        discipline,
      });
      setPlan(data);
      storeSlcrChoice(raceId, { eventId, discipline });
    });

  // Zápis do ostré evidence – vždy až po potvrzení.
  const createRaces = async () => {
    if (!(await confirm(createConfirm(plan, { ...planSummary(plan), dryRun })))) return;
    await createRacesNow();
  };
  const sendResults = async () => {
    const eventName =
      plan?.event?.name || events?.find((event) => String(event.id) === eventId)?.name;
    if (!(await confirm(sendConfirm(eventName, dryRun)))) return;
    await sendResultsNow();
  };

  const createRacesNow = () =>
    run('races', async () => {
      const data = await TimekeeperAPI.postOnline(
        `/api/timekeeper/races/${raceId}/slcr/races`,
        body(),
      );
      setPlan({ event: data.event, items: data.items });
      setMessage({ type: 'success', text: createdMessage(data) });
    });

  const sendResultsNow = () =>
    run('results', async () => {
      const data = await TimekeeperAPI.postOnline(
        `/api/timekeeper/races/${raceId}/slcr/results`,
        body(),
      );
      storeSlcrChoice(raceId, { eventId, discipline });
      setSent(true);
      setMessage({ type: 'success', text: sentMessage(data) });
    });

  const dryRun = Boolean(status?.dry_run);
  const problems = configProblems(status);
  const configured = Boolean(status) && problems.length === 0;
  const summary = planSummary(plan);
  // Výsledky se k závodům přiřazují podle kodexu – nejdřív musí být všechny založené.
  const missingRaces = Boolean(plan) && summary.changes > 0;
  const idle = !busy;

  const canPreview = configured && Boolean(eventId) && idle;
  const canCreate = configured && Boolean(plan) && summary.changes > 0 && summary.manual && idle;
  const canSend = configured && Boolean(eventId) && hasResults && !missingRaces && idle;

  let step = 1;
  if (plan) step = missingRaces ? 2 : 3;

  return {
    status,
    dryRun,
    problems,
    configured,
    disciplines: status?.disciplines?.length ? status.disciplines : null,
    events,
    eventsError,
    eventId,
    setEventId,
    discipline,
    setDiscipline,
    plan,
    summary,
    missingRaces,
    busy,
    sent,
    message,
    clearMessage: () => setMessage(null),
    step,
    canPreview,
    canCreate,
    canSend,
    loadPlan,
    createRaces,
    sendResults,
  };
}
