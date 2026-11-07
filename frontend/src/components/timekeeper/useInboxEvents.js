import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SYNC_QUEUE_EVENT } from '../../offline/syncQueue.js';
import {
  applyMatchPatches,
  INBOX_EVENT,
  INBOX_REV_KEY,
  listInboxEvents,
  reconcileQueuedInboxEvents,
  recoverStaleSavingEvents,
  beginInboxEventSave,
  clearInboxEvents,
  rejectUnparsedInboxEvents,
  isLiveInboxEvent,
  isResolvedInboxEvent,
  updateInboxEvent,
} from '../../offline/bridgeInbox.js';
import { parseIncomingTime } from '../../utils/serial.js';
import {
  compareCandidates,
  isAutoWriteCandidate,
  isBibCandidate,
  isRoundEmpty,
  matchesBib,
  normalizeBib,
  resolveInboxEvent,
  roundField,
  roundMatchesAutoWrite,
} from './inboxMatching.js';
import { isExcluded } from './startListHelpers.js';
import { liveWriterIds } from './writerPresence.js';

/**
 * Kolik řádků inboxu se vykresluje, dokud si obsluha nevyžádá všechny. Zbytek
 * zůstává uložený, jen se nezobrazí.
 */
export const INBOX_RENDER_LIMIT = 100;

/** Změny inboxu chodí po dávkách; jedno čtení tabulky na dávku stačí. */
const INBOX_REFRESH_DEBOUNCE_MS = 120;

/** Zotavení přerušených zápisů se musí opakovat, ne běžet jen při mountu. */
const INBOX_RECOVERY_INTERVAL_MS = 20000;

/** Přepínač "Zapisovat automaticky" - platí pro zařízení, ne pro závod. */
export const AUTO_WRITE_KEY = 'timekeeper_bridge_auto_write';

/** Výchozí stav je zapnuto; vypnuto jen po výslovném vypnutí na tomhle zařízení. */
export const readAutoWrite = () => {
  try {
    return localStorage.getItem(AUTO_WRITE_KEY) !== '0';
  } catch {
    return true;
  }
};

const storeAutoWrite = (value) => {
  try {
    localStorage.setItem(AUTO_WRITE_KEY, value ? '1' : '0');
  } catch {
    // anonymní režim / plná kvóta - přepínač platí aspoň do obnovení stránky
  }
};

/** Draft řádku startovky: rozepsaná hodnota, jinak to, co je uložené. */
const currentDraft = (entry, edited) => ({
  ...(edited || {
    time1: entry.time1 != null ? String(entry.time1) : '',
    time2: entry.time2 != null ? String(entry.time2) : '',
    dnf: Boolean(entry.dnf),
    dns: Boolean(entry.dns),
    dsq: Boolean(entry.dsq),
  }),
});

/**
 * Schránka impulzů z časomíry: odvozený pohled a všechny operace nad ní.
 *
 * Stav samotný žije v IndexedDB (offline/bridgeInbox.js) - tady je jen jeho
 * podoba pro obrazovku a překlad "potvrdit řádek" na zápis času. Vytaženo
 * z TimingEntry, kde to tvořilo skoro třetinu souboru.
 *
 * Refy chodí zvenčí, protože je sdílí i ukládání času: handlery musí vidět
 * aktuální startovku, aniž by se překreslovaly při každé její změně.
 */
export function useInboxEvents({
  inboxEvents,
  setInboxEvents,
  startList,
  startListById,
  selectedRaceId,
  queueSave,
  confirm,
  setMessage,
  setEditedTimes,
  startListRef,
  startListByIdRef,
  inboxEventsRef,
  selectedRaceIdRef,
  editedTimesRef,
  hasWriteLockRef,
  bridgeTargetRoundRef,
  tabIdRef,
  sessionStartedAt,
  loading,
  readOnlyMessage,
  hasWriteLock = false,
}) {
  // Inbox se čte z IndexedDB, ne z paměti: události chodí i když je obrazovka
  // zavřená, a přes `storage` i z karty, která drží sériový port.
  useEffect(() => {
    let cancelled = false;
    let running = false;
    let firstPass = true;

    const sweep = async () => {
      if (running) return;
      running = true;
      const orphanBefore = firstPass ? sessionStartedAt : null;
      firstPass = false;
      try {
        const recovered = await recoverStaleSavingEvents({
          orphanBefore,
          liveWriters: liveWriterIds(),
        });
        const { failed } = await reconcileQueuedInboxEvents();
        if (cancelled) return;
        if (recovered > 0) {
          setMessage({
            type: 'warning',
            text: `${recovered} událostí z časomíry zůstalo po přerušeném ukládání – jsou znovu k potvrzení.`,
          });
        } else if (failed > 0) {
          setMessage({
            type: 'danger',
            text: `${failed} potvrzených událostí se nepodařilo odeslat na server. Zkontrolujte je v inboxu a v Synchronizaci.`,
          });
        }
      } catch {
        if (!cancelled) {
          setMessage({
            type: 'danger',
            text: 'Nepodařilo se zkontrolovat uložené události z časomíry.',
          });
        }
      } finally {
        running = false;
      }
    };

    sweep();
    const onQueueChanged = () => {
      sweep();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') sweep();
    };
    const timer = window.setInterval(sweep, INBOX_RECOVERY_INTERVAL_MS);
    window.addEventListener(SYNC_QUEUE_EVENT, onQueueChanged);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(SYNC_QUEUE_EVENT, onQueueChanged);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const refresh = async () => {
      try {
        const rows = await listInboxEvents(selectedRaceId);
        if (!cancelled) setInboxEvents(rows);
      } catch {
        if (!cancelled) {
          setMessage({ type: 'danger', text: 'Nepodařilo se načíst uložené události z časomíry.' });
        }
      }
    };

    const schedule = () => {
      if (timer || cancelled) return;
      timer = window.setTimeout(() => {
        timer = null;
        refresh();
      }, INBOX_REFRESH_DEBOUNCE_MS);
    };

    const onStorage = (event) => {
      if (event.key === INBOX_REV_KEY) schedule();
    };

    refresh();
    window.addEventListener(INBOX_EVENT, schedule);
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener(INBOX_EVENT, schedule);
      window.removeEventListener('storage', onStorage);
    };
  }, [selectedRaceId]);

  const liveInboxCount = useMemo(() => inboxEvents.filter(isLiveInboxEvent).length, [inboxEvents]);
  const resolvedInboxCount = useMemo(
    () => inboxEvents.filter(isResolvedInboxEvent).length,
    [inboxEvents],
  );
  const unassignedInboxCount = useMemo(
    () => inboxEvents.filter((row) => row.race_id == null).length,
    [inboxEvents],
  );
  const unparsedInboxCount = useMemo(
    () => inboxEvents.filter((row) => row.reason === 'unparsed' && row.status === 'warning').length,
    [inboxEvents],
  );

  // Celý log závodu musí jít kdykoli projít, proto jde limit vypnout.
  const [showAllInbox, setShowAllInbox] = useState(false);

  // Skrývají se jen vyřízené řádky. Nevyřízený řádek je naměřený čas, který
  // nikde jinde není, takže ten se nesmí ztratit ani z pohledu.
  const visibleInboxEvents = useMemo(() => {
    if (showAllInbox || inboxEvents.length <= INBOX_RENDER_LIMIT) return inboxEvents;
    const live = inboxEvents.filter(isLiveInboxEvent);
    const resolved = inboxEvents
      .filter((row) => !isLiveInboxEvent(row))
      .slice(0, Math.max(INBOX_RENDER_LIMIT - live.length, 0));
    return [...live, ...resolved];
  }, [inboxEvents, showAllInbox]);

  const hiddenInboxCount = inboxEvents.length - visibleInboxEvents.length;

  const inboxResolutions = useMemo(() => {
    const resolutions = new Map();
    visibleInboxEvents.forEach((row) => {
      resolutions.set(row.id, resolveInboxEvent(row, startList, startListById));
    });
    return resolutions;
  }, [visibleInboxEvents, startList, startListById]);

  const inboxResolutionsRef = useRef(inboxResolutions);
  useEffect(() => {
    inboxResolutionsRef.current = inboxResolutions;
  }, [inboxResolutions]);

  // Vyřazení ze startky kandidáty nejsou (isBibCandidate). Řádek, jehož dres
  // patří jen vyřazenému, zůstane "nenalezený" a vysvětlí to resolveInboxEvent.
  const candidateIdsForBib = useCallback((bib) => {
    const value = normalizeBib(bib);
    if (value == null) return [];
    return startListRef.current
      .filter((row) => isBibCandidate(row, value))
      .sort(compareCandidates)
      .map((row) => row.id);
  }, []);

  /** Jen do paměti - řádek už je v takovém stavu uložený v IndexedDB. */
  const patchInboxRowLocally = useCallback((eventId, patch) => {
    setInboxEvents((prev) => prev.map((row) => (row.id === eventId ? { ...row, ...patch } : row)));
  }, []);

  const patchInboxRow = useCallback(async (eventId, patch) => {
    setInboxEvents((prev) => prev.map((row) => (row.id === eventId ? { ...row, ...patch } : row)));
    try {
      await updateInboxEvent(eventId, patch);
    } catch {
      setMessage({
        type: 'danger',
        text: 'Stav události z časomíry se nepodařilo uložit do zařízení. Po obnovení stránky se řádek vrátí do původního stavu.',
      });
    }
  }, []);

  /** Přesně ten závodník, kterého má řádek vykreslený - viz resolveInboxEvent. */
  const resolveEntryForEvent = useCallback((event) => {
    if (!event) return null;
    const cached = inboxResolutionsRef.current.get(event.id);
    if (cached) return cached.entry;
    return resolveInboxEvent(event, startListRef.current, startListByIdRef.current).entry;
  }, []);

  const cycleBridgeCandidate = useCallback(
    (eventId) => {
      const event = inboxEventsRef.current.find((row) => row.id === eventId);
      if (!event) return;

      let candidateIds = Array.isArray(event.candidateEntryIds) ? event.candidateEntryIds : [];
      const bib = normalizeBib(event.bib);
      const stillValid = candidateIds.filter((id) => {
        const entry = startListByIdRef.current[id];
        if (!entry || isExcluded(entry)) return false;
        return bib == null || matchesBib(entry, bib);
      });

      if (stillValid.length === 0 && event.bib != null) {
        candidateIds = candidateIdsForBib(Number(event.bib));
      } else {
        candidateIds = stillValid;
      }
      if (candidateIds.length === 0) return;

      // Řádek odložený jako "dres není ve startovce" se ručním výběrem oživí.
      const reopen = event.status === 'warning' && event.reason === 'bib_not_found';

      if (candidateIds.length === 1) {
        if (event.selectedEntryId === candidateIds[0]) return;
        patchInboxRow(eventId, {
          candidateEntryIds: candidateIds,
          selectedEntryId: candidateIds[0],
          ...(reopen ? { status: 'pending', level: 'info', reason: 'ready' } : {}),
        });
        return;
      }

      const nextIndex =
        (Math.max(candidateIds.indexOf(event.selectedEntryId), 0) + 1) % candidateIds.length;
      patchInboxRow(eventId, {
        candidateEntryIds: candidateIds,
        selectedEntryId: candidateIds[nextIndex],
        ...(reopen ? { status: 'pending', level: 'info', reason: 'multiple_matches' } : {}),
      });
    },
    [patchInboxRow, candidateIdsForBib],
  );

  const rejectBridgeEvent = useCallback(
    (eventId) => {
      patchInboxRow(eventId, {
        status: 'rejected',
        level: 'secondary',
        reason: 'manually_rejected',
        race_id: Number(selectedRaceIdRef.current) || null,
      });
    },
    [patchInboxRow],
  );

  /**
   * Dohledání dresu na pozadí.
   *
   * Události přicházejí bez závodu i bez závodníka (feed ze zařízení o závodu
   * nic neví), takže párování musí proběhnout tady, jakmile je startovka
   * načtená. applyMatchPatches doplňuje jen nevyplněná pole - výběr, který
   * udělala obsluha, nikdy nepřepíše.
   */
  useEffect(() => {
    if (!selectedRaceId || loading || startList.length === 0) return undefined;

    const unmatched = inboxEvents.filter(
      (row) =>
        row.selectedEntryId == null &&
        !Array.isArray(row.candidateEntryIds) &&
        row.bib != null &&
        (row.status === 'pending' || (row.status === 'warning' && row.reason === 'bib_not_found')),
    );
    if (unmatched.length === 0) return undefined;

    const patches = [];
    unmatched.forEach((row) => {
      const targetRound = row.targetRound || bridgeTargetRoundRef.current;

      if (normalizeBib(row.bib) == null) {
        if (row.status === 'warning' && row.reason === 'missing_bib') return;
        patches.push({
          id: row.id,
          status: 'warning',
          level: 'warning',
          reason: 'missing_bib',
          targetRound,
        });
        return;
      }

      const candidateIds = candidateIdsForBib(Number(row.bib));
      if (candidateIds.length === 0) {
        if (row.status === 'warning' && row.reason === 'bib_not_found') return;
        patches.push({
          id: row.id,
          status: 'warning',
          level: 'warning',
          reason: 'bib_not_found',
          targetRound,
        });
        return;
      }

      patches.push({
        id: row.id,
        candidateEntryIds: candidateIds,
        selectedEntryId: candidateIds[0],
        status: 'pending',
        level: 'info',
        reason: candidateIds.length > 1 ? 'multiple_matches' : 'ready',
        targetRound,
      });
    });
    if (patches.length === 0) return undefined;

    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) await applyMatchPatches(patches);
      } catch {
        if (!cancelled) {
          setMessage({
            type: 'danger',
            text: 'Nepodařilo se přiřadit události z časomíry k závodníkům.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inboxEvents, startList, loading, selectedRaceId, candidateIdsForBib]);

  /**
   * Zápis jedné události do kola závodníka - společná cesta pro potvrzení obsluhou i pro
   * automatický zápis.
   *
   * `entryIdHint` je id, které měl vykreslený řádek pod tlačítkem potvrzení. Bez něj by se
   * závodník počítal podruhé a mohl vyjít jinak, než co obsluha viděla.
   * Zabrání se tady i tomu, aby dvě karty zapsaly jeden impulz dvakrát:
   * beginInboxEventSave je compare-and-set nad uloženým řádkem.
   *
   * S `auto` se navíc trvá na prázdném kole (obsazené zůstane ruční a řádek to
   * řekne), nehlásí se nic, co by obsluhu rušilo, a do řádku se uloží, co
   * v kole bylo předtím - podle toho pak "Zamítnout" kolo vrátí.
   */
  const writeBridgeEvent = useCallback(
    async (eventId, entryIdHint = null, { auto = false } = {}) => {
      const event = inboxEventsRef.current.find((row) => row.id === eventId);
      if (
        !event ||
        event.status === 'saved' ||
        event.status === 'saving' ||
        event.status === 'queued'
      )
        return;
      if (!hasWriteLockRef.current) {
        if (!auto) setMessage({ type: 'warning', text: readOnlyMessage });
        return;
      }

      const raceId = Number(selectedRaceIdRef.current) || null;
      if (!raceId) {
        if (!auto)
          setMessage({
            type: 'warning',
            text: 'Nejprve vyberte závod – teprve potvrzením se čas přiřadí k závodu.',
          });
        return;
      }

      // Vyřazenému ze startky se čas nezapisuje, ani když na něj ukazuje nápověda.
      const hinted = entryIdHint != null ? startListByIdRef.current[entryIdHint] : null;
      const entry = (hinted && !isExcluded(hinted) ? hinted : null) || resolveEntryForEvent(event);
      if (!entry) {
        await patchInboxRow(eventId, {
          status: 'warning',
          level: 'warning',
          reason: 'bib_not_found',
        });
        return;
      }

      const entryId = entry.id;
      const previousDraft = currentDraft(entry, editedTimesRef.current[entryId]);
      const nextDraft = { ...previousDraft };
      const field = roundField(event.targetRound);

      if (auto && !isRoundEmpty(entry, previousDraft, field)) {
        // Obsazené kolo se automaticky nikdy nepřepisuje - zůstává na potvrzení obsluhou.
        await patchInboxRow(eventId, { level: 'warning', reason: 'round_occupied' });
        return;
      }

      if (event.type === 'TIME') {
        const seconds = parseIncomingTime(event.time);
        if (seconds == null) {
          await patchInboxRow(eventId, {
            status: 'warning',
            level: 'warning',
            reason: 'invalid_time',
          });
          return;
        }
        nextDraft[field] = seconds.toFixed(2);
        nextDraft.dnf = false;
        nextDraft.dns = false;
        nextDraft.dsq = false;
      } else if (event.type === 'DNS' || event.type === 'DNF' || event.type === 'DSQ') {
        nextDraft.dns = event.type === 'DNS';
        nextDraft.dnf = event.type === 'DNF';
        nextDraft.dsq = event.type === 'DSQ';
      } else {
        // Jiný typ nemá kam zapsat; dřív spadl do větve příznaků a smazal DNF/DNS/DSQ.
        await patchInboxRow(eventId, {
          status: 'warning',
          level: 'warning',
          reason: 'unsupported_type',
        });
        return;
      }

      let claim;
      try {
        claim = await beginInboxEventSave(eventId, {
          raceId,
          selectedEntryId: entryId,
          writerId: tabIdRef.current,
        });
      } catch {
        setMessage({
          type: 'danger',
          text: 'Událost z časomíry se nepodařilo otevřít k zápisu (chyba lokální databáze). Čas zatím nebyl uložen.',
        });
        return;
      }

      if (!claim.ok) {
        if (claim.row) patchInboxRowLocally(eventId, claim.row);
        // Automatický zápis, který předběhla jiná karta, není chyba obsluhy.
        if (auto) return;
        if (claim.reason === 'taken') {
          setMessage({
            type: 'warning',
            text: 'Tuto událost mezitím zpracovala jiná karta – zkontrolujte výsledek v inboxu.',
          });
        } else if (claim.reason === 'other_race') {
          setMessage({
            type: 'warning',
            text: 'Tato událost už patří k jinému závodu – v tomto závodě ji potvrdit nelze.',
          });
        } else {
          setMessage({
            type: 'danger',
            text: 'Událost z časomíry se v zařízení nenašla – obnovte stránku.',
          });
        }
        return;
      }
      patchInboxRowLocally(eventId, claim.row);

      setEditedTimes((prev) => ({ ...prev, [entryId]: nextDraft }));
      editedTimesRef.current = { ...editedTimesRef.current, [entryId]: nextDraft };

      const outcome = await queueSave(entryId, nextDraft, 'Nepodařilo se uložit událost z bridge');
      const racer = `${entry.racer_surname || ''} ${entry.racer_name || ''}`.trim();
      const common = {
        race_id: raceId,
        racer,
        selectedEntryId: entryId,
        saving_started_at: null,
        saving_writer_id: null,
        // Co bylo v kole předtím a co se zapsalo; ručně potvrzený řádek nic z toho nemá.
        auto_written: auto,
        auto_previous: auto
          ? {
              field,
              value: previousDraft[field],
              dnf: previousDraft.dnf,
              dns: previousDraft.dns,
              dsq: previousDraft.dsq,
            }
          : null,
        auto_value: auto
          ? {
              field,
              value: nextDraft[field],
              dnf: nextDraft.dnf,
              dns: nextDraft.dns,
              dsq: nextDraft.dsq,
            }
          : null,
      };

      if (outcome.ok && outcome.queued) {
        const opId = outcome.opId;
        const queueId = outcome.queueId;
        if (opId || queueId) {
          await patchInboxRow(eventId, {
            ...common,
            status: 'queued',
            level: 'info',
            reason: 'queued_offline',
            sync_op_id: opId,
            sync_queue_id: queueId,
          });
          return;
        }
        // Zařazeno do fronty, ale bez identifikátoru se nedá dohledat, jestli
        // dojelo - takový řádek nesmí vypadat jako hotový.
        await patchInboxRow(eventId, {
          ...common,
          status: 'save_failed',
          level: 'danger',
          reason: 'sync_unknown',
          sync_op_id: null,
          sync_queue_id: null,
        });
        return;
      }

      await patchInboxRow(eventId, {
        ...common,
        status: outcome.ok ? 'saved' : 'save_failed',
        level: outcome.ok ? 'success' : 'danger',
        reason: outcome.ok ? null : 'save_failed',
        sync_op_id: null,
        sync_queue_id: null,
      });
    },
    [patchInboxRow, patchInboxRowLocally, queueSave, resolveEntryForEvent],
  );

  /** Potvrzení jedné události obsluhou (Přiřadit a uložit). */
  const confirmBridgeEvent = useCallback(
    (eventId, entryIdHint = null) => writeBridgeEvent(eventId, entryIdHint),
    [writeBridgeEvent],
  );

  // Přepínač "Zapisovat automaticky", pamatuje si ho zařízení.
  const [autoWrite, setAutoWriteState] = useState(readAutoWrite);
  const setAutoWrite = useCallback((value) => {
    const next = Boolean(value);
    storeAutoWrite(next);
    setAutoWriteState(next);
  }, []);

  // Události, které už automatický zápis v téhle kartě zkoušel. Podruhé se
  // nezkouší nikdy: co neprošlo, zůstává obsluze.
  const autoTriedRef = useRef(new Set());
  const autoRunningRef = useRef(false);
  const autoAgainRef = useRef(false);

  // Od kdy automatický zápis v téhle kartě běží. Zapisují se jen impulzy,
  // které přišly potom - starší čekající (nastřádané při vypnutém přepínači,
  // před obnovením stránky, zkušební impulzy před startem) zůstávají obsluze.
  // Vypnutí, ztráta zámku nebo změna závodu hranici zruší; další zapnutí
  // začne od nové chvíle.
  const autoSinceRef = useRef(null);
  useEffect(() => {
    autoSinceRef.current =
      autoWrite && hasWriteLock && selectedRaceId ? new Date().toISOString() : null;
  }, [autoWrite, hasWriteLock, selectedRaceId]);
  const isFreshForAuto = (row) =>
    autoSinceRef.current != null &&
    typeof row.created_at === 'string' &&
    row.created_at >= autoSinceRef.current;

  /**
   * Automatický zápis.
   *
   * Zapisuje jen karta s write lockem (jinak by dvě karty zapsaly jeden impulz
   * dvakrát), jen do vybraného závodu a jen událost s jediným kandidátem.
   * Obsazené kolo, neplatný čas a všechny výjimky párování zůstávají ruční.
   * Události se zpracují postupně od nejstarší: dva impulzy téhož dresu tak
   * nezapíšou oba - druhý už uvidí kolo obsazené prvním.
   */
  useEffect(() => {
    if (!autoWrite || !hasWriteLock || !selectedRaceId || loading || startList.length === 0) return;
    if (
      !inboxEvents.some(
        (row) =>
          isAutoWriteCandidate(row) && isFreshForAuto(row) && !autoTriedRef.current.has(row.id),
      )
    )
      return;

    if (autoRunningRef.current) {
      autoAgainRef.current = true;
      return;
    }

    const run = async () => {
      autoRunningRef.current = true;
      try {
        do {
          autoAgainRef.current = false;
          const pending = [...inboxEventsRef.current]
            .filter(
              (row) =>
                isAutoWriteCandidate(row) &&
                isFreshForAuto(row) &&
                !autoTriedRef.current.has(row.id),
            )
            .sort((a, b) => a.id - b.id);
          for (const row of pending) {
            if (!hasWriteLockRef.current || !selectedRaceIdRef.current) return;
            autoTriedRef.current.add(row.id);
            await writeBridgeEvent(row.id, row.selectedEntryId, { auto: true });
          }
        } while (autoAgainRef.current);
      } finally {
        autoRunningRef.current = false;
      }
    };
    run();
  }, [inboxEvents, startList, loading, selectedRaceId, autoWrite, hasWriteLock, writeBridgeEvent]);

  /**
   * "Zamítnout" u automaticky zapsané události: vrátí kolo na hodnotu, kterou
   * mělo těsně před zápisem, a událost označí jako zamítnutou.
   *
   * Když se hodnota kola mezitím změnila (někdo ji opravil ručně), zamítnutí se
   * odmítne s vysvětlením - vrácením by se potichu přepsala novější hodnota.
   * Kdo zamítl, se nezaznamenává.
   */
  const rejectAutoWrittenEvent = useCallback(
    async (eventId) => {
      const event = inboxEventsRef.current.find((row) => row.id === eventId);
      if (!event || !event.auto_written || (event.status !== 'saved' && event.status !== 'queued'))
        return;
      if (!hasWriteLockRef.current) {
        setMessage({ type: 'warning', text: readOnlyMessage });
        return;
      }
      const previous = event.auto_previous;
      const written = event.auto_value;
      const entry = startListByIdRef.current[event.selectedEntryId];
      if (!entry || !previous || !written) {
        setMessage({
          type: 'warning',
          text: 'Závodník této události není v načtené startovce – kolo opravte ručně v tabulce.',
        });
        return;
      }

      const entryId = entry.id;
      const current = currentDraft(entry, editedTimesRef.current[entryId]);
      const racer =
        `${entry.racer_surname || ''} ${entry.racer_name || ''}`.trim() || `#${entryId}`;
      if (!roundMatchesAutoWrite(current, written)) {
        setMessage({
          type: 'warning',
          text: `Kolo závodníka ${racer} se po automatickém zápisu změnilo – zamítnutím by se přepsala novější hodnota. Opravte ho ručně v tabulce.`,
        });
        return;
      }

      const revertDraft = {
        ...current,
        [previous.field]: previous.value ?? '',
        dnf: Boolean(previous.dnf),
        dns: Boolean(previous.dns),
        dsq: Boolean(previous.dsq),
      };
      setEditedTimes((prev) => ({ ...prev, [entryId]: revertDraft }));
      editedTimesRef.current = { ...editedTimesRef.current, [entryId]: revertDraft };

      const outcome = await queueSave(
        entryId,
        revertDraft,
        'Nepodařilo se vrátit automaticky zapsaný čas',
      );
      if (!outcome.ok) return;

      await patchInboxRow(eventId, {
        status: 'rejected',
        level: 'secondary',
        reason: 'auto_rejected',
        // Řádek už nečeká na svou operaci ve frontě - jinak by ho sladění
        // s frontou vrátilo do stavu "zapsáno".
        sync_op_id: null,
        sync_queue_id: null,
      });
    },
    [patchInboxRow, queueSave],
  );

  const clearResolvedInbox = async () => {
    if (!selectedRaceId || resolvedInboxCount === 0) return;
    const ok = await confirm({
      title: `Smazat ${resolvedInboxCount} vyřízených řádků ze schránky?`,
      message: `Smažou se řádky potvrzené a prokazatelně odeslané na server a zamítnuté. Časy zapsané v listině zůstanou. Zůstane ${liveInboxCount} řádků – nepotvrzené, čekající na synchronizaci, chybové i varovné. Ty obsahují naměřené časy, které nejsou zapsané nikde jinde.`,
      confirmLabel: `Smazat ${resolvedInboxCount} řádků`,
      // Mazání: Enter ho nesmí potvrdit, fokus dostane Zrušit.
      danger: true,
      icon: 'trash',
    });
    if (!ok) return;
    try {
      const removed = await clearInboxEvents(selectedRaceId, { onlyResolved: true });
      setMessage({
        type: 'info',
        text: `Smazáno ${removed} vyřízených událostí. ${liveInboxCount} nevyřízených zůstalo.`,
      });
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se smazat vyřízené události.' });
    }
  };

  const dismissUnparsedInbox = async () => {
    if (!selectedRaceId || unparsedInboxCount === 0) return;
    const ok = await confirm({
      title: `Odbavit ${unparsedInboxCount} nerozpoznané řádky?`,
      message: `${unparsedInboxCount} řádků z časomíry se nepodařilo rozpoznat. Potvrzením prohlásíte, že to nejsou naměřené časy – zůstanou uložené jako zamítnuté a půjdou pak smazat tlačítkem „Smazat vyřízené“.`,
      confirmLabel: `Odbavit ${unparsedInboxCount} řádky`,
      icon: 'check',
    });
    if (!ok) return;
    try {
      const dismissed = await rejectUnparsedInboxEvents(selectedRaceId);
      setMessage({ type: 'info', text: `Odbaveno ${dismissed} nerozpoznaných řádků.` });
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se odbavit nerozpoznané řádky.' });
    }
  };

  const clearWholeInbox = async () => {
    if (!selectedRaceId) return;
    const ok = await confirm({
      title: `Smazat celou schránku – všech ${inboxEvents.length} událostí?`,
      message:
        liveInboxCount > 0
          ? `Smaže se ${inboxEvents.length} řádků včetně ${liveInboxCount} nevyřízených – naměřené časy, které zatím nikdo nezapsal${unassignedInboxCount > 0 ? ` (z toho ${unassignedInboxCount} zatím nepřiřazených k žádnému závodu)` : ''}. Akci nelze vrátit zpět.`
          : `Smaže se všech ${inboxEvents.length} uložených událostí. Akci nelze vrátit zpět.`,
      confirmLabel: `Smazat ${inboxEvents.length} událostí`,
      danger: true,
      icon: 'trash',
    });
    if (!ok) return;
    try {
      const removed = await clearInboxEvents(selectedRaceId);
      setMessage({ type: 'info', text: `Smazáno ${removed} událostí.` });
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se smazat události.' });
    }
  };
  return {
    liveInboxCount,
    resolvedInboxCount,
    unassignedInboxCount,
    unparsedInboxCount,
    visibleInboxEvents,
    hiddenInboxCount,
    showAllInbox,
    setShowAllInbox,
    inboxResolutions,
    cycleBridgeCandidate,
    confirmBridgeEvent,
    rejectBridgeEvent,
    rejectAutoWrittenEvent,
    autoWrite,
    setAutoWrite,
    clearResolvedInbox,
    dismissUnparsedInbox,
    clearWholeInbox,
  };
}
