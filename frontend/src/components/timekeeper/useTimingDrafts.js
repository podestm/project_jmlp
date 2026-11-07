import { useCallback, useEffect } from 'react';
import { saveTimingDrafts } from '../../offline/timingDrafts.js';
import { isSameDraft, normalizeDraft } from './timingRules.js';

/** Rozepsané časy se do zařízení ukládají až po odmlce v psaní. */
const DRAFT_SAVE_DEBOUNCE_MS = 700;

/**
 * Uchová rozepsané, dosud neuložené časy v zařízení.
 *
 * Potvrzený čas je trvanlivý sám o sobě - jde přes TimekeeperAPI do
 * synchronizační fronty. Díra zbývá u hodnoty, která pořád sedí v políčku,
 * když se tablet restartuje. Tenhle hook ji zavírá.
 *
 * Ukládá se s odkladem, ale navíc při zhasnutí obrazovky, zavření karty
 * i odchodu z obrazovky - odložený zápis by v těch chvílích nedoběhl.
 *
 * @param {object}   refs           editedTimesRef, originalTimesRef,
 *   selectedRaceIdRef, hasWriteLockRef, draftsRaceRef - drží je rodič,
 *   protože je používá i ukládání a zotavení po pádu karty
 * @param {function} onError        hlášení selhání zápisu do IndexedDB
 * @returns {{persistDrafts: function}} ruční uložení (volá se po úspěšném
 *   zápisu, aby se posunula základna draftu)
 */
export function useTimingDrafts({
  selectedRaceId,
  editedTimes,
  loading,
  editedTimesRef,
  originalTimesRef,
  selectedRaceIdRef,
  hasWriteLockRef,
  draftsRaceRef,
  onError,
}) {
  const collectDrafts = useCallback(() => {
    const drafts = {};
    Object.entries(editedTimesRef.current).forEach(([entryId, draft]) => {
      const base = originalTimesRef.current[entryId];
      if (!draft || !base || isSameDraft(draft, base)) return;
      drafts[entryId] = {
        time1: draft.time1 ?? '',
        time2: draft.time2 ?? '',
        dnf: Boolean(draft.dnf),
        dns: Boolean(draft.dns),
        dsq: Boolean(draft.dsq),
        base: normalizeDraft(base),
      };
    });
    return drafts;
  }, [editedTimesRef, originalTimesRef]);

  const persistDrafts = useCallback(
    (raceId) => {
      const target = raceId ?? selectedRaceIdRef.current;
      // Kontrola závodu je zásadní: prázdná sada z jiného závodu by smazala
      // koncepty, které k němu patří.
      if (!target || !hasWriteLockRef.current || draftsRaceRef.current !== String(target)) return;
      saveTimingDrafts(target, collectDrafts()).catch(() => {
        onError('Nepodařilo se uložit rozepsané časy do zařízení.');
      });
    },
    [collectDrafts, selectedRaceIdRef, hasWriteLockRef, draftsRaceRef, onError],
  );

  useEffect(() => {
    if (!selectedRaceId || loading) return undefined;
    const timer = window.setTimeout(() => persistDrafts(selectedRaceId), DRAFT_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [editedTimes, selectedRaceId, loading, persistDrafts]);

  // Odložený zápis by při zhasnutí tabletu nebo zavření karty nedoběhl.
  useEffect(() => {
    const raceId = selectedRaceId;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistDrafts(raceId);
    };
    const onLeave = () => persistDrafts(raceId);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onLeave);
    window.addEventListener('beforeunload', onLeave);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onLeave);
      window.removeEventListener('beforeunload', onLeave);
      persistDrafts(raceId);
    };
  }, [selectedRaceId, persistDrafts]);

  return { persistDrafts };
}
