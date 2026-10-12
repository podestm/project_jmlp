import { useCallback, useEffect, useState } from 'react';
import { TimekeeperAPI } from '../../../../config/timekeeperApi.js';
import {
  DEFAULT_DISCIPLINE, publishConfirm, publishedMessage, readSlcrChoice, slcrErrorText,
} from './slcr.js';

/**
 * Výsledky do evidence SLČR po kategoriích během závodu: stav každé
 * kategorie v akci a odeslání + zveřejnění jedné kategorie (po potvrzení).
 * Akci bere z volby uložené ráno v dialogu Evidence SLČR (slcr_event_{raceId});
 * `version` se zvedne po zavření dialogu, aby se volba načetla znovu.
 * Jen online, bez fronty – zveřejnění se nesmí odložit a provést později.
 */
export function useSlcrCategories({ raceId, isOnline, confirm, version = 0 }) {
  const [choice, setChoice] = useState(() => readSlcrChoice(raceId));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => { setChoice(readSlcrChoice(raceId)); }, [raceId, version]);

  const eventId = choice.eventId ? String(choice.eventId) : '';

  const load = useCallback(async () => {
    if (!raceId || !eventId || !isOnline) return;
    setLoading(true);
    setError(null);
    try {
      setData(await TimekeeperAPI.getOnline(`/api/timekeeper/races/${raceId}/slcr/categories`, { event_id: eventId }));
    } catch (err) {
      setError(slcrErrorText(err));
    } finally {
      setLoading(false);
    }
  }, [raceId, eventId, isOnline]);

  useEffect(() => {
    setData(null);
    setMessage(null);
    load();
  }, [load]);

  const items = data?.categories || [];
  const find = (categoryId) => items.find((item) => String(item.category_id) === String(categoryId)) || null;

  const publish = async (categoryId, categoryName) => {
    const current = find(categoryId);
    const ask = publishConfirm({
      categoryName,
      eventName: data?.event?.name,
      correction: current?.slcr_state === 'Published',
      dryRun: data?.dry_run,
    });
    if (!await confirm(ask)) return;
    setBusyId(String(categoryId));
    setMessage(null);
    try {
      const result = await TimekeeperAPI.postOnline(
        `/api/timekeeper/races/${raceId}/slcr/categories/${categoryId}/publish`,
        { event_id: Number(eventId), discipline: Number(choice.discipline) || DEFAULT_DISCIPLINE },
      );
      setData((prev) => prev && {
        ...prev,
        categories: prev.categories.map((item) => (
          String(item.category_id) === String(categoryId) ? result.category : item
        )),
      });
      setMessage({ categoryId: String(categoryId), type: 'success', text: publishedMessage(categoryName, result) });
    } catch (err) {
      setMessage({ categoryId: String(categoryId), type: 'danger', text: slcrErrorText(err) });
    } finally {
      setBusyId(null);
    }
  };

  return {
    eventId,
    event: data?.event || null,
    dryRun: Boolean(data?.dry_run),
    items,
    find,
    loading,
    error,
    reload: load,
    busyId,
    message,
    clearMessage: () => setMessage(null),
    publish,
  };
}
