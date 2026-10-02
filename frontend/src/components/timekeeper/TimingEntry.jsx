import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TimekeeperAPI } from '../../config/timekeeperApi.js';
import { useConfirm } from '../../hooks/useConfirm.jsx';
import { useRacePdf } from '../../hooks/useRacePdf.js';
import LoadingState from '../ui/LoadingState.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { SELECTED_RACE_KEY } from './TimekeeperChrome.jsx';
import { useSerialSession } from './SerialSessionProvider.jsx';
import { START_LIST_REVISION_EVENT } from '../../offline/localEdits.js';
import { loadTimingDrafts } from '../../offline/timingDrafts.js';
import { useTimingDrafts } from './useTimingDrafts.js';
import { useInboxEvents } from './useInboxEvents.js';
import { useTabWriteLock } from './useTabWriteLock.js';
import { useTimeSaving } from './useTimeSaving.jsx';
import {
  mergeRestoredDrafts,
} from './timingRules.js';
import {
  forgetWriter,
  markWriterAlive,
  WRITER_HEARTBEAT_MS,
} from './writerPresence.js';
import { activeEntries, groupEntriesByCategory } from './startListHelpers.js';
import PdfPreviewModal from './PdfPreviewModal.jsx';
import SerialInboxPanel from './SerialInboxPanel.jsx';
import TimingTable from './TimingTable.jsx';
import TimingToolbar from './TimingToolbar.jsx';

/**
 * Zadávání časů: ruční tabulka vlevo, inbox událostí z časomíry vpravo.
 *
 * Obrazovka nevlastní ani sériový port (drží ho SerialSessionProvider nad
 * <Routes>), ani inbox (ten je v IndexedDB). Její jediná odpovědnost je spojit
 * uloženou událost se závodníkem a na povel obsluhy ji zapsat - všechno ostatní
 * musí přežít odchod z obrazovky i obnovení stránky.
 *
 * Řádek tabulky je v TimingRow.jsx a řádek inboxu v BridgeEventRow.jsx: obojí
 * je memoizované a při psaní do jednoho pole se překreslí jen dotčený řádek.
 * Proto tady mají skoro všechny handlery useCallback - jakmile jeden z nich
 * začne měnit identitu, memoizace přestane platit a startovka o 250 řádcích se
 * překresluje na každou stisknutou klávesu.
 */

/** Od kolika po sobě nerozpoznaných řádků se hlásí špatně nastavená časomíra. */
const UNPARSED_STREAK_ALERT = 3;
/** Start téhle karty: zápis, který začal dřív, tady rozhodně neběží. */
const SESSION_STARTED_AT = Date.now();

const READ_ONLY_MESSAGE = 'Tato karta je pouze pro čtení. Aktivní editace běží v jiné kartě.';

export default function TimingEntry() {
  const serial = useSerialSession();
  const { confirm, confirmElement } = useConfirm();

  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(localStorage.getItem(SELECTED_RACE_KEY) || '');
  const [startList, setStartList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [editedTimes, setEditedTimes] = useState({});
  const [filter, setFilter] = useState('all'); // all, pending, completed
  const [activeRound, setActiveRound] = useState('both'); // 'both', '1', '2'
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' nebo category_name
  const [bridgeTargetRound, setBridgeTargetRound] = useState(
    localStorage.getItem('timekeeper_bridge_target_round') || '1'
  );
  const [inboxEvents, setInboxEvents] = useState([]);

  const pdf = useRacePdf(selectedRaceId);

  const editedTimesRef = useRef({});
  const originalTimesRef = useRef({});
  const startListRef = useRef([]);
  const startListByIdRef = useRef({});
  const inboxEventsRef = useRef([]);
  const filteredListRef = useRef([]);
  const activeRoundRef = useRef(activeRound);
  const hasWriteLockRef = useRef(true);
  const bridgeTargetRoundRef = useRef(bridgeTargetRound);
  const savingEntriesRef = useRef(new Set());
  // Zápisy do jednoho řádku se řetězí: dvě uložení téhož záznamu naráz si
  // navzájem podrazí base_revision a druhé skončí zbytečným konfliktem.
  const saveChainRef = useRef(new Map());
  const saveEntryRef = useRef(null);
  const conflictOpenRef = useRef(false);
  const skipBlurRef = useRef(null);
  const selectedRaceIdRef = useRef(selectedRaceId);
  const loadTokenRef = useRef(0);
  // Závod, jehož startovka se opravdu načetla. Drafty se smějí zapisovat jen
  // pro něj - prázdná sada po neúspěšném načtení vypadá stejně jako "nic
  // rozepsaného" a smazala by uložené časy.
  const draftsRaceRef = useRef(null);
  const tabIdRef = useRef(typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  // Až za tabIdRef: hook si ho bere, takže dřív by to bylo použití
  // před inicializací a celá sekce časoměřiče by spadla.
  const hasWriteLock = useTabWriteLock(selectedRaceId, tabIdRef);

  useEffect(() => { loadRaces(); }, []);

  useEffect(() => {
    selectedRaceIdRef.current = selectedRaceId;
    if (selectedRaceId) {
      loadStartList(selectedRaceId);
      localStorage.setItem(SELECTED_RACE_KEY, selectedRaceId);
    }
  }, [selectedRaceId]);

  useEffect(() => { editedTimesRef.current = editedTimes; }, [editedTimes]);
  useEffect(() => { startListRef.current = startList; }, [startList]);
  useEffect(() => { inboxEventsRef.current = inboxEvents; }, [inboxEvents]);
  useEffect(() => { activeRoundRef.current = activeRound; }, [activeRound]);
  useEffect(() => { hasWriteLockRef.current = hasWriteLock; }, [hasWriteLock]);

  useEffect(() => {
    bridgeTargetRoundRef.current = bridgeTargetRound;
    localStorage.setItem('timekeeper_bridge_target_round', bridgeTargetRound);
  }, [bridgeTargetRound]);

  useEffect(() => {
    const writerId = tabIdRef.current;
    markWriterAlive(writerId);
    const timer = window.setInterval(() => markWriterAlive(writerId), WRITER_HEARTBEAT_MS);
    const drop = () => forgetWriter(writerId);
    window.addEventListener('pagehide', drop);
    window.addEventListener('beforeunload', drop);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', drop);
      window.removeEventListener('beforeunload', drop);
      drop();
    };
  }, []);

  // Řádky zamrzlé ve stavu "saving" po pádu karty a fronta, která se mezitím
  // dosynchronizovala. Obojí se musí kontrolovat opakovaně: řádek starý dvě
  // vteřiny při otevření obrazovky je za minutu starý minutu a nikdo kvůli
  // tomu stránku znovu neobnoví.

  useEffect(() => {
    const onRevisions = (event) => {
      const revisions = event?.detail?.revisions;
      if (!revisions || Object.keys(revisions).length === 0) return;
      setStartList((prev) => {
        let changed = false;
        const next = prev.map((entry) => {
          if (!Object.prototype.hasOwnProperty.call(revisions, String(entry.id))) return entry;
          const revision = revisions[String(entry.id)] ?? null;
          if (entry.updated_at === revision) return entry;
          changed = true;
          return { ...entry, updated_at: revision };
        });
        return changed ? next : prev;
      });
    };
    window.addEventListener(START_LIST_REVISION_EVENT, onRevisions);
    return () => window.removeEventListener(START_LIST_REVISION_EVENT, onRevisions);
  }, []);

  // Inbox se čte z IndexedDB, ne z paměti: události chodí i když je obrazovka
  // zavřená, a přes `storage` i z karty, která drží sériový port.

  const reportDraftError = useCallback((text) => setMessage({ type: 'danger', text }), []);

  const { persistDrafts } = useTimingDrafts({
    selectedRaceId,
    editedTimes,
    loading,
    editedTimesRef,
    originalTimesRef,
    selectedRaceIdRef,
    hasWriteLockRef,
    draftsRaceRef,
    onError: reportDraftError,
  });


  const loadRaces = async () => {
    try {
      const data = await TimekeeperAPI.get('/api/timekeeper/races');
      setRaces(data);
    } catch (err) {
      console.error('Failed to load races:', err);
    }
  };

  /**
   * Načtení startovky. Přepnutí závodu během běžícího požadavku je běžné,
   * proto se výsledek zahazuje, když už mezitím platí jiný token nebo závod -
   * jinak by starší odpověď přepsala novější startovku.
   */
  const loadStartList = async (raceId) => {
    const target = raceId ?? selectedRaceIdRef.current;
    if (!target) return;

    const token = loadTokenRef.current + 1;
    loadTokenRef.current = token;
    const isCurrent = () => loadTokenRef.current === token && String(selectedRaceIdRef.current) === String(target);

    try {
      setLoading(true);
      const data = await TimekeeperAPI.get(`/api/timekeeper/races/${target}/start-list`);
      if (!isCurrent()) return;

      setStartList(data);
      const times = {};
      const byId = {};
      data.forEach((entry) => {
        byId[entry.id] = entry;
        times[entry.id] = {
          time1: entry.time1 != null ? String(entry.time1) : '',
          time2: entry.time2 != null ? String(entry.time2) : '',
          dnf: entry.dnf || false,
          dns: entry.dns || false,
          dsq: entry.dsq || false,
        };
      });
      originalTimesRef.current = { ...times };

      const drafts = await loadTimingDrafts(target);
      if (!isCurrent()) return;

      const { times: merged, restored, dropped } = mergeRestoredDrafts(times, byId, drafts);
      editedTimesRef.current = merged;
      setEditedTimes(merged);
      setSelectedCategory('all');
      draftsRaceRef.current = String(target);

      if (restored > 0 || dropped > 0) {
        const parts = [];
        if (restored > 0) parts.push(`Obnoveno ${restored} rozepsaných časů z tohoto zařízení.`);
        if (dropped > 0) parts.push(`${dropped} rozepsaných časů bylo zahozeno – záznam se mezitím změnil na serveru.`);
        setMessage({ type: dropped > 0 ? 'warning' : 'info', text: parts.join(' ') });
      }
    } catch {
      if (!isCurrent()) return;
      setStartList([]);
      editedTimesRef.current = {};
      setEditedTimes({});
      originalTimesRef.current = {};
      draftsRaceRef.current = null;
      setMessage({
        type: 'danger',
        text: 'Nepodařilo se načíst startovní listinu. Rozepsané časy zůstávají uložené v zařízení.'
      });
    } finally {
      if (loadTokenRef.current === token) setLoading(false);
    }
  };

  const {
    updateTime,
    registerInput,
    queueSave,
    toggleFlag,
    saveAllTimes,
    handleBlur,
    handleKeyDown,
  } = useTimeSaving({
    selectedRaceId,
    setStartList,
    setEditedTimes,
    setSaving,
    setMessage,
    confirm,
    persistDrafts,
    editedTimesRef,
    originalTimesRef,
    startListByIdRef,
    filteredListRef,
    activeRoundRef,
    hasWriteLockRef,
    savingEntriesRef,
    saveChainRef,
    saveEntryRef,
    conflictOpenRef,
    skipBlurRef,
    readOnlyMessage: READ_ONLY_MESSAGE,
    hasWriteLock,
  });

  // Vyřazení ze startky (isExcluded) se v tabulce, filtrech, počtech ani
  // v tisku neukazují. `startList` je ale drží dál: rozepsané časy se jim
  // nesmí ztratit a inbox časomíry podle nich pozná, proč dres nikomu nepatří.
  const activeStartList = useMemo(() => activeEntries(startList), [startList]);
  const excludedCount = startList.length - activeStartList.length;

  const categoryList = useMemo(() => {
    const cats = new Map();
    activeStartList.forEach((entry) => {
      const catName = entry.category_name || 'Bez kategorie';
      if (!cats.has(catName)) {
        cats.set(catName, { name: catName, count: 0 });
      }
      cats.get(catName).count++;
    });
    return [...cats.values()];
  }, [activeStartList]);

  const startListById = useMemo(() => {
    const byId = {};
    startList.forEach((entry) => {
      byId[entry.id] = entry;
    });
    return byId;
  }, [startList]);

  useEffect(() => { startListByIdRef.current = startListById; }, [startListById]);

  const categoryFiltered = useMemo(() => (
    selectedCategory === 'all'
      ? activeStartList
      : activeStartList.filter((e) => (e.category_name || 'Bez kategorie') === selectedCategory)
  ), [activeStartList, selectedCategory]);

  const filteredList = useMemo(() => (
    categoryFiltered.filter((entry) => {
      if (filter === 'pending') {
        return entry.time1 == null && entry.time2 == null && !entry.dnf && !entry.dns && !entry.dsq;
      }
      if (filter === 'completed') {
        return entry.time1 != null || entry.time2 != null || entry.dnf || entry.dns || entry.dsq;
      }
      return true;
    })
  ), [categoryFiltered, filter]);

  useEffect(() => { filteredListRef.current = filteredList; }, [filteredList]);

  /**
   * Tisk průběžných výsledků rovnou od časomíry.
   *
   * Tiskne se z toho, co je na obrazovce (včetně už uložených časů, které se
   * ještě nesynchronizovaly), takže to funguje i offline. Kolo se vybírá
   * zvlášť - každá kategorie může jet jiný počet kol.
   *
   * @param {string} runMode 'sum' | '1' | '2'
   * @param {string} scope   'category' = vybraná kategorie, 'all' = všechny
   */
  const printResults = useCallback(async (runMode, scope) => {
    const source = scope === 'category' ? categoryFiltered : activeStartList;
    const categories = groupEntriesByCategory(source);
    if (categories.length === 0) {
      setMessage({ type: 'warning', text: 'Není co tisknout - startovní listina je prázdná.' });
      return;
    }
    try {
      await pdf.generate({ categories, interim: true, runMode });
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se vytvořit PDF' });
    }
  }, [categoryFiltered, activeStartList, pdf]);

  const completedCount = useMemo(() => (
    categoryFiltered.filter((e) => e.time1 != null || e.time2 != null || e.dnf || e.dns || e.dsq).length
  ), [categoryFiltered]);
  const selectedRace = races.find((r) => String(r.id) === String(selectedRaceId));

  const {
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
    clearResolvedInbox,
    dismissUnparsedInbox,
    clearWholeInbox,
  } = useInboxEvents({
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
    sessionStartedAt: SESSION_STARTED_AT,
    loading,
    readOnlyMessage: READ_ONLY_MESSAGE,
  });

  return (
    <div>
      <TimingToolbar
        races={races}
        selectedRace={selectedRace}
        selectedRaceId={selectedRaceId}
        setSelectedRaceId={setSelectedRaceId}
        startListLength={activeStartList.length}
        categoryList={categoryList}
        categoryFilteredLength={categoryFiltered.length}
        completedCount={completedCount}
        filter={filter}
        setFilter={setFilter}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        activeRound={activeRound}
        setActiveRound={setActiveRound}
        saving={saving}
        saveAllTimes={saveAllTimes}
        hasWriteLock={hasWriteLock}
        loading={loading}
        message={message}
        onDismissMessage={() => setMessage(null)}
        serial={serial}
        bridgeTargetRound={bridgeTargetRound}
        setBridgeTargetRound={setBridgeTargetRound}
        liveInboxCount={liveInboxCount}
        resolvedInboxCount={resolvedInboxCount}
        unassignedInboxCount={unassignedInboxCount}
        unparsedStreakAlert={UNPARSED_STREAK_ALERT}
        onPrintResults={printResults}
        printBusy={pdf.generating}
      />

      {loading && <LoadingState variant="timekeeper" />}

      {!loading && selectedRaceId && (
        <div className="row g-3 align-items-start">
          <div className="col-12 col-xl-7">
            {excludedCount > 0 && (
              <div className="small text-muted mb-1">
                <i className="bi bi-person-dash me-1"></i>
                Vyřazení ze startovní listiny ({excludedCount}) se tu nezobrazují – vrátit je jde v Listině.
              </div>
            )}
            <TimingTable
              entries={filteredList}
              editedTimes={editedTimes}
              activeRound={activeRound}
              hasWriteLock={hasWriteLock}
              showCategory={selectedCategory === 'all'}
              registerInput={registerInput}
              onTimeChange={updateTime}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onToggleFlag={toggleFlag}
              startListEmpty={activeStartList.length === 0}
            />
          </div>

          <div className="col-12 col-xl-5">
            <SerialInboxPanel
              events={inboxEvents}
              visibleEvents={visibleInboxEvents}
              hiddenCount={hiddenInboxCount}
              showAll={showAllInbox}
              onShowAllChange={setShowAllInbox}
              resolutions={inboxResolutions}
              targetRound={bridgeTargetRound}
              unparsedCount={unparsedInboxCount}
              resolvedCount={resolvedInboxCount}
              onCycle={cycleBridgeCandidate}
              onConfirm={confirmBridgeEvent}
              onReject={rejectBridgeEvent}
              onDismissUnparsed={dismissUnparsedInbox}
              onClearResolved={clearResolvedInbox}
              onClearAll={clearWholeInbox}
            />
          </div>
        </div>
      )}

      {!selectedRaceId && (
        <>
          {inboxEvents.length > 0 && (
            <div className="alert alert-info py-2 small" role="alert">
              <i className="bi bi-inbox-fill me-2"></i>
              Časomíra už poslala {inboxEvents.length} událostí, které zatím nepatří k žádnému závodu.
              Vyberte závod – zobrazí se zde a půjdou potvrdit. Nic se neztratilo.
            </div>
          )}
          <EmptyState icon="bi-hand-index" title="Vyberte závod pro zadávání časů" />
        </>
      )}

      {pdf.objectUrl && (
        <PdfPreviewModal
          objectUrl={pdf.objectUrl}
          title={pdf.previewTitle}
          canPublish={false}
          publishing={false}
          onDownload={pdf.download}
          onClose={pdf.closePreview}
        />
      )}

      {confirmElement}
    </div>
  );
}
