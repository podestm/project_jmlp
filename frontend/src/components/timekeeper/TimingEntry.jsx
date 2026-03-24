import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TimekeeperAPI } from '../../config/api.js';
import RaceNumberBadge from './RaceNumberBadge.jsx';
import { getRaceNumberBadgeStyle } from '../../utils/raceNumbers.js';

const TAB_LOCK_HEARTBEAT_MS = 3000;
const TAB_LOCK_STALE_MS = 9000;
const SERIAL_BAUD_KEY = 'timekeeper_serial_baud';
const BRIDGE_DEDUP_MS = 1500;
const BRIDGE_LOG_MAX = 40;

export default function TimingEntry() {
  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(
    localStorage.getItem('timekeeper_selected_race') || ''
  );
  const [startList, setStartList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [editedTimes, setEditedTimes] = useState({});
  const [filter, setFilter] = useState('all'); // all, pending, completed
  const [activeRound, setActiveRound] = useState('both'); // 'both', '1', '2'
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' or category_name
  const [bridgeBaud, setBridgeBaud] = useState(localStorage.getItem(SERIAL_BAUD_KEY) || '9600');
  const [bridgeTargetRound, setBridgeTargetRound] = useState(localStorage.getItem('timekeeper_bridge_target_round') || '1');
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState('Odpojeno');
  const [bridgeSerialSupported] = useState(typeof navigator !== 'undefined' && 'serial' in navigator);
  const [bridgeCanUseSerial] = useState(typeof location !== 'undefined' && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'));
  const [bridgePort, setBridgePort] = useState(null);
  const [bridgeEvents, setBridgeEvents] = useState([]);
  const inputRefs = useRef({});
  const editedTimesRef = useRef({});
  const originalTimesRef = useRef({});
  const startListRef = useRef([]);
  const selectedRaceIdRef = useRef(selectedRaceId);
  const hasWriteLockRef = useRef(true);
  const bridgeTargetRoundRef = useRef(bridgeTargetRound);
  const savingEntriesRef = useRef(new Set());
  const skipBlurRef = useRef(null);
  const tabIdRef = useRef(typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const lastLockKeyRef = useRef(null);
  const bridgeReaderRef = useRef(null);
  const bridgeSerialPortRef = useRef(null);
  const bridgeDedupRef = useRef(new Map());
  const [hasWriteLock, setHasWriteLock] = useState(true);

  useEffect(() => { loadRaces(); }, []);

  useEffect(() => {
    if (selectedRaceId) {
      loadStartList();
      localStorage.setItem('timekeeper_selected_race', selectedRaceId);
    }
  }, [selectedRaceId]);

  useEffect(() => {
    editedTimesRef.current = editedTimes;
  }, [editedTimes]);

  useEffect(() => {
    startListRef.current = startList;
  }, [startList]);

  useEffect(() => {
    selectedRaceIdRef.current = selectedRaceId;
    setBridgeEvents([]);
    bridgeDedupRef.current.clear();
  }, [selectedRaceId]);

  useEffect(() => {
    hasWriteLockRef.current = hasWriteLock;
  }, [hasWriteLock]);

  useEffect(() => {
    localStorage.setItem(SERIAL_BAUD_KEY, bridgeBaud);
  }, [bridgeBaud]);

  useEffect(() => {
    bridgeTargetRoundRef.current = bridgeTargetRound;
    localStorage.setItem('timekeeper_bridge_target_round', bridgeTargetRound);
  }, [bridgeTargetRound]);

  useEffect(() => () => {
    if (bridgeReaderRef.current) {
      try {
        bridgeReaderRef.current.cancel();
      } catch {
        // ignore
      }
      bridgeReaderRef.current = null;
    }
    if (bridgeSerialPortRef.current) {
      try {
        bridgeSerialPortRef.current.close();
      } catch {
        // ignore
      }
      bridgeSerialPortRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!selectedRaceId) {
      setHasWriteLock(true);
      return undefined;
    }

    const lockKey = `timekeeper_timing_lock_${selectedRaceId}`;
    const tabId = tabIdRef.current;

    const safeParse = (value) => {
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };

    const readLock = () => safeParse(localStorage.getItem(lockKey));
    const writeLock = () => {
      localStorage.setItem(lockKey, JSON.stringify({ tab_id: tabId, ts: Date.now() }));
    };
    const isStale = (lock) => !lock?.ts || (Date.now() - Number(lock.ts)) > TAB_LOCK_STALE_MS;

    const releasePreviousLock = () => {
      const previousKey = lastLockKeyRef.current;
      if (!previousKey || previousKey === lockKey) return;
      const lock = safeParse(localStorage.getItem(previousKey));
      if (lock?.tab_id === tabId) {
        localStorage.removeItem(previousKey);
      }
    };

    const ensureLockState = () => {
      const lock = readLock();
      if (!lock || lock.tab_id === tabId || isStale(lock)) {
        writeLock();
        setHasWriteLock(true);
        return;
      }
      setHasWriteLock(false);
    };

    releasePreviousLock();
    lastLockKeyRef.current = lockKey;
    ensureLockState();

    const heartbeat = () => {
      const lock = readLock();
      if (!lock || lock.tab_id === tabId || isStale(lock)) {
        writeLock();
        setHasWriteLock(true);
      } else {
        setHasWriteLock(false);
      }
    };

    const onStorage = (event) => {
      if (event.key === lockKey) {
        ensureLockState();
      }
    };

    const intervalId = window.setInterval(heartbeat, TAB_LOCK_HEARTBEAT_MS);
    window.addEventListener('storage', onStorage);

    const releaseLock = () => {
      const lock = readLock();
      if (lock?.tab_id === tabId) {
        localStorage.removeItem(lockKey);
      }
    };

    window.addEventListener('beforeunload', releaseLock);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('beforeunload', releaseLock);
      releaseLock();
    };
  }, [selectedRaceId]);

  const loadRaces = async () => {
    try {
      const data = await TimekeeperAPI.get('/api/timekeeper/races');
      setRaces(data);
    } catch (err) {
      console.error('Failed to load races:', err);
    }
  };

  const loadStartList = async () => {
    if (!selectedRaceId) return;
    try {
      setLoading(true);
      const data = await TimekeeperAPI.get(`/api/timekeeper/races/${selectedRaceId}/start-list`);
      setStartList(data);
      const times = {};
      data.forEach(entry => {
        times[entry.id] = {
          time1: entry.time1 != null ? String(entry.time1) : '',
          time2: entry.time2 != null ? String(entry.time2) : '',
          dnf: entry.dnf || false,
          dns: entry.dns || false,
          dsq: entry.dsq || false,
        };
      });
      setEditedTimes(times);
      originalTimesRef.current = { ...times };
      setSelectedCategory('all');
    } catch (err) {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst startovní listinu' });
    } finally {
      setLoading(false);
    }
  };

  const updateTime = (entryId, field, value) => {
    if (!hasWriteLock) return;
    setEditedTimes(prev => ({
      ...prev,
      [entryId]: { ...prev[entryId], [field]: value }
    }));
  };

  const parseStoredTime = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const calculateTimeSum = (data) => {
    if (data.dnf || data.dns || data.dsq) return null;
    const time1 = parseStoredTime(data.time1);
    const time2 = parseStoredTime(data.time2);
    if (time1 != null && time2 != null) return time1 + time2;
    if (time1 != null) return time1;
    if (time2 != null) return time2;
    return null;
  };

  const applySavedEntryToStartList = (entryId, data) => {
    const time1 = parseStoredTime(data.time1);
    const time2 = parseStoredTime(data.time2);
    const timeSum = calculateTimeSum(data);

    setStartList(prev => prev.map(entry => (
      entry.id === entryId
        ? {
            ...entry,
            time1,
            time2,
            dnf: Boolean(data.dnf),
            dns: Boolean(data.dns),
            dsq: Boolean(data.dsq),
            time_sum: timeSum,
            updated_at: data.updated_at || entry.updated_at,
          }
        : entry
    )));
  };

  const getEntryRevision = (entryId) => {
    const row = startListById[entryId];
    return row ? (row.updated_at || null) : null;
  };

  const buildTimeUpdate = (data) => ({
    base_revision: data.base_revision || null,
    force_apply: Boolean(data.force_apply) || false,
    time1: data.time1 !== '' ? parseFloat(data.time1) : null,
    time2: data.time2 !== '' ? parseFloat(data.time2) : null,
    dnf: data.dnf || false,
    dns: data.dns || false,
    dsq: data.dsq || false,
  });

  const normalizeDraft = (data) => ({
    time1: data?.time1 !== '' && data?.time1 != null ? parseFloat(data.time1) : null,
    time2: data?.time2 !== '' && data?.time2 != null ? parseFloat(data.time2) : null,
    dnf: Boolean(data?.dnf),
    dns: Boolean(data?.dns),
    dsq: Boolean(data?.dsq),
  });

  const isSameDraft = (a, b) => {
    const x = normalizeDraft(a);
    const y = normalizeDraft(b);
    return x.time1 === y.time1 && x.time2 === y.time2 && x.dnf === y.dnf && x.dns === y.dns && x.dsq === y.dsq;
  };

  const focusInput = (entryId, field) => {
    const ref = inputRefs.current[`${entryId}-${field}`];
    if (ref) {
      ref.focus();
      ref.select();
    }
  };

  const focusNextInput = (entryId, field) => {
    const currentIndex = filteredList.findIndex(entry => entry.id === entryId);
    if (currentIndex === -1) return;

    if (field === 'time1') {
      if (activeRound === 'both') {
        focusInput(entryId, 'time2');
        return;
      }
      if (currentIndex < filteredList.length - 1) {
        focusInput(filteredList[currentIndex + 1].id, 'time1');
      }
      return;
    }

    if (currentIndex < filteredList.length - 1) {
      const nextField = activeRound === '2' ? 'time2' : 'time1';
      focusInput(filteredList[currentIndex + 1].id, nextField);
    }
  };

  const saveEntry = async (entryId, data, errorText) => {
    if (!data || savingEntriesRef.current.has(entryId)) return false;
    if (!hasWriteLock) {
      setMessage({ type: 'warning', text: 'Tato karta je pouze pro čtení. Aktivní editace běží v jiné kartě.' });
      return false;
    }

    try {
      savingEntriesRef.current.add(entryId);
      const result = await TimekeeperAPI.put(
        `/api/timekeeper/start-list/${entryId}/time`,
        buildTimeUpdate({ ...data, base_revision: getEntryRevision(entryId) })
      );
      applySavedEntryToStartList(entryId, {
        ...data,
        updated_at: result?.revision || getEntryRevision(entryId),
      });
      originalTimesRef.current[entryId] = {
        ...data,
      };
      return true;
    } catch (err) {
      const staleEntryId = err?.detail?.entry_id;
      const conflictMessage = err?.status === 409
        ? `Konflikt změny: záznam ${staleEntryId ? `#${staleEntryId}` : ''} byl mezitím upraven jinde.`.trim()
        : errorText;
      setMessage({ type: 'danger', text: conflictMessage });
      return false;
    } finally {
      savingEntriesRef.current.delete(entryId);
    }
  };

  const toggleFlag = (entryId, flag) => {
    if (!hasWriteLock) {
      setMessage({ type: 'warning', text: 'Tato karta je pouze pro čtení. Aktivní editace běží v jiné kartě.' });
      return;
    }
    setEditedTimes(prev => {
      const updated = { ...prev[entryId], [flag]: !prev[entryId]?.[flag] };
      // Save immediately with the new values (avoid stale state race condition)
      saveFlagUpdate(entryId, updated);
      return { ...prev, [entryId]: updated };
    });
  };

  const saveFlagUpdate = async (entryId, data) => {
    if (!data) return;
    await saveEntry(entryId, data, 'Nepodařilo se uložit stav');
  };

  const saveAllTimes = async () => {
    if (!selectedRaceId) return;
    if (!hasWriteLock) {
      setMessage({ type: 'warning', text: 'Tato karta je pouze pro čtení. Aktivní editace běží v jiné kartě.' });
      return;
    }
    try {
      setSaving(true);
      const changedEntries = Object.entries(editedTimesRef.current)
        .filter(([id, data]) => !isSameDraft(data, originalTimesRef.current[id]))
        .map(([id, data]) => ({ id: parseInt(id), data }));

      if (changedEntries.length === 0) {
        setMessage({ type: 'info', text: 'Žádné změny k uložení.' });
        return;
      }

      const entries = changedEntries.map(({ id, data }) => ({
        entry_id: id,
        base_revision: getEntryRevision(id),
        force_apply: false,
        ...normalizeDraft(data),
      }));

      const result = await TimekeeperAPI.post(`/api/timekeeper/races/${selectedRaceId}/times`, { entries });
      changedEntries.forEach(({ id, data }) => {
        applySavedEntryToStartList(id, {
          ...data,
          updated_at: result?.revision || getEntryRevision(id),
        });
        originalTimesRef.current[id] = { ...data };
      });
      setMessage({ type: 'success', text: result.message });
    } catch (err) {
      const staleEntryId = err?.detail?.entry_id;
      const conflictMessage = err?.status === 409
        ? `Konflikt dávky: záznam ${staleEntryId ? `#${staleEntryId}` : ''} byl mezitím upraven.`.trim()
        : 'Nepodařilo se uložit časy';
      setMessage({ type: 'danger', text: conflictMessage });
    } finally {
      setSaving(false);
    }
  };

  const saveSingleTime = async (entryId) => {
    if (!hasWriteLock) return false;
    const data = editedTimesRef.current[entryId];
    if (!data) return false;
    return saveEntry(entryId, data, 'Nepodařilo se uložit čas');
  };

  const handleBlur = (entryId, field) => {
    if (!hasWriteLock) return;
    const blurKey = `${entryId}-${field}`;
    if (skipBlurRef.current === blurKey) {
      skipBlurRef.current = null;
      return;
    }
    saveSingleTime(entryId);
  };

  const handleKeyDown = async (e, entryId, field) => {
    if (!hasWriteLock) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      skipBlurRef.current = `${entryId}-${field}`;
      await saveSingleTime(entryId);
      if (field === 'time1' && activeRound === 'both') {
        focusInput(entryId, 'time2');
      } else {
        focusNextInput(entryId, field);
      }
    }

    if (e.key === 'Tab' && !e.shiftKey && field === 'time1') {
      e.preventDefault();
      skipBlurRef.current = `${entryId}-${field}`;
      await saveSingleTime(entryId);
      focusNextInput(entryId, field);
    }

    if (e.key === 'Tab' && !e.shiftKey && field === 'time2') {
      e.preventDefault();
      skipBlurRef.current = `${entryId}-${field}`;
      await saveSingleTime(entryId);
      focusNextInput(entryId, field);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Get unique categories from start list
  const categoryList = useMemo(() => {
    const cats = new Map();
    startList.forEach(entry => {
      const catName = entry.category_name || 'Bez kategorie';
      if (!cats.has(catName)) {
        cats.set(catName, { name: catName, count: 0 });
      }
      cats.get(catName).count++;
    });
    return [...cats.values()];
  }, [startList]);

  const startListById = useMemo(() => {
    const byId = {};
    startList.forEach((entry) => {
      byId[entry.id] = entry;
    });
    return byId;
  }, [startList]);

  const categoryFiltered = useMemo(() => (
    selectedCategory === 'all'
      ? startList
      : startList.filter((e) => (e.category_name || 'Bez kategorie') === selectedCategory)
  ), [startList, selectedCategory]);

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

  const completedCount = useMemo(() => (
    categoryFiltered.filter((e) => e.time1 != null || e.time2 != null || e.dnf || e.dns || e.dsq).length
  ), [categoryFiltered]);
  const selectedRace = races.find(r => String(r.id) === String(selectedRaceId));
  const pendingBridgeCount = useMemo(() => (
    bridgeEvents.filter((item) => item.status === 'pending' || item.status === 'saving').length
  ), [bridgeEvents]);
  const bridgeResolvedCount = useMemo(() => (
    bridgeEvents.filter((item) => item.status !== 'pending' && item.status !== 'saving').length
  ), [bridgeEvents]);

  const parseIncomingTime = (raw) => {
    if (raw == null) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    const normalized = String(raw).trim().replace(',', '.');
    if (!normalized) return null;
    if (/^\d+(\.\d+)?$/.test(normalized)) {
      const seconds = parseFloat(normalized);
      return Number.isFinite(seconds) ? seconds : null;
    }
    const parts = normalized.split(':');
    if (parts.length === 2) {
      const minutes = parseFloat(parts[0]);
      const sec = parseFloat(parts[1]);
      if (Number.isFinite(minutes) && Number.isFinite(sec)) {
        return (minutes * 60) + sec;
      }
    }
    if (parts.length === 3) {
      const hours = parseFloat(parts[0]);
      const minutes = parseFloat(parts[1]);
      const sec = parseFloat(parts[2]);
      if (Number.isFinite(hours) && Number.isFinite(minutes) && Number.isFinite(sec)) {
        return (hours * 3600) + (minutes * 60) + sec;
      }
    }
    return null;
  };

  const buildBridgeCandidates = (bib) => (
    startListRef.current
      .filter((row) => Number(row.race_number_actual) === bib)
      .sort((a, b) => {
        const aStart = a.start_number ?? Number.MAX_SAFE_INTEGER;
        const bStart = b.start_number ?? Number.MAX_SAFE_INTEGER;
        if (aStart !== bStart) return aStart - bStart;
        return a.id - b.id;
      })
      .map((row) => row.id)
  );

  const pushBridgeEvent = (event, level = 'info') => {
    const row = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      level,
      status: event.status || ((level === 'warning' || level === 'danger') ? 'warning' : 'pending'),
      ...event,
    };
    setBridgeEvents((prev) => [row, ...prev].slice(0, BRIDGE_LOG_MAX));
  };

  const formatBridgeReason = (reason) => {
    switch (reason) {
      case 'read_only_tab':
        return 'Karta je jen pro čtení';
      case 'missing_bib':
        return 'Chybí číslo dresu';
      case 'duplicate_ignored':
        return 'Duplicitní událost byla ignorována';
      case 'invalid_time':
        return 'Neplatný formát času';
      case 'unsupported_type':
        return 'Nepodporovaný typ události';
      case 'bib_not_found':
        return 'Číslo dresu není ve startovní listině';
      case 'multiple_matches':
        return 'Nalezeno více kandidátů se stejným číslem';
      case 'save_failed':
        return 'Uložení selhalo';
      case 'invalid_json':
        return 'Bridge poslal neplatný JSON';
      case 'manually_rejected':
        return 'Událost byla ručně zamítnuta';
      case 'ready':
      case null:
      case undefined:
        return '';
      default:
        return reason;
    }
  };

  const updateBridgeEvent = (eventId, updater) => {
    setBridgeEvents((prev) => prev.map((item) => {
      if (item.id !== eventId) return item;
      return typeof updater === 'function' ? updater(item) : { ...item, ...updater };
    }));
  };

  const cycleBridgeCandidate = (eventId) => {
    updateBridgeEvent(eventId, (item) => {
      let candidateIds = item.candidateEntryIds || [];
      
      // Fallback: if candidates were lost, rebuild from bib
      if (candidateIds.length === 0 && item.bib && startListRef.current) {
        candidateIds = startListRef.current
          .filter((row) => Number(row.race_number_actual) === item.bib)
          .sort((a, b) => {
            const aStart = a.start_number ?? Number.MAX_SAFE_INTEGER;
            const bStart = b.start_number ?? Number.MAX_SAFE_INTEGER;
            if (aStart !== bStart) return aStart - bStart;
            return a.id - b.id;
          })
          .map((row) => row.id);
      }
      
      if (candidateIds.length <= 1) return item;
      
      const currentIndex = Math.max(candidateIds.indexOf(item.selectedEntryId), 0);
      const nextIndex = (currentIndex + 1) % candidateIds.length;
      
      return {
        ...item,
        candidateEntryIds: candidateIds,
        selectedEntryId: candidateIds[nextIndex],
      };
    });
  };

  const rejectBridgeEvent = (eventId) => {
    updateBridgeEvent(eventId, {
      status: 'rejected',
      level: 'secondary',
      reason: 'manually_rejected',
    });
  };

  const pickRoundField = (draft) => {
    if (activeRound === '1') return 'time1';
    if (activeRound === '2') return 'time2';
    const t1 = parseStoredTime(draft.time1);
    const t2 = parseStoredTime(draft.time2);
    if (t1 == null) return 'time1';
    if (t2 == null) return 'time2';
    return null;
  };

  const processBridgeEvent = async (event) => {
    if (!event || !selectedRaceIdRef.current) return;
    if (!hasWriteLockRef.current) {
      pushBridgeEvent({ type: 'SKIP', reason: 'read_only_tab' }, 'warning');
      return;
    }

    const kind = String(event.type || '').toUpperCase();
    const bib = Number(event.bib ?? event.number ?? event.actual_number);
    if (!Number.isFinite(bib)) {
      pushBridgeEvent({ type: kind || 'UNKNOWN', reason: 'missing_bib' }, 'warning');
      return;
    }

    const dedupKey = `${kind}|${bib}|${event.time ?? ''}`;
    const now = Date.now();
    const lastSeen = bridgeDedupRef.current.get(dedupKey) || 0;
    if ((now - lastSeen) < BRIDGE_DEDUP_MS) {
      pushBridgeEvent({ type: kind, bib, reason: 'duplicate_ignored' }, 'warning');
      return;
    }
    bridgeDedupRef.current.set(dedupKey, now);

    if (kind === 'TIME') {
      const seconds = parseIncomingTime(event.time);
      if (seconds == null) {
        pushBridgeEvent({ type: kind, bib, reason: 'invalid_time' }, 'warning');
        return;
      }
    } else if (kind !== 'DNS' && kind !== 'DNF' && kind !== 'DSQ') {
      pushBridgeEvent({ type: kind || 'UNKNOWN', bib, reason: 'unsupported_type' }, 'warning');
      return;
    }

    const candidateEntryIds = buildBridgeCandidates(bib);

    pushBridgeEvent({
      type: kind,
      bib,
      time: event.time,
      targetRound: bridgeTargetRoundRef.current,
      candidateEntryIds,
      selectedEntryId: candidateEntryIds[0] || null,
      status: candidateEntryIds.length > 0 ? 'pending' : 'warning',
      reason: candidateEntryIds.length > 1 ? 'multiple_matches' : (candidateEntryIds.length === 0 ? 'bib_not_found' : 'ready'),
    }, candidateEntryIds.length > 0 ? 'info' : 'warning');
  };

  const parseSerialBridgeLine = (line) => {
    const trimmed = String(line || '').trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('{')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
    }

    const parts = trimmed.replace(',', '.').split(';').map((item) => item.trim());
    if (parts.length < 2) return null;
    const kind = String(parts[0] || '').toUpperCase();
    if (!['TIME', 'DNS', 'DNF', 'DSQ'].includes(kind)) return null;
    const bib = Number(parts[1]);
    if (!Number.isFinite(bib)) return null;

    if (kind === 'TIME') {
      if (parts.length < 3) return null;
      return { type: kind, bib, time: parts[2], raw: trimmed, ts: Date.now() / 1000 };
    }

    return { type: kind, bib, raw: trimmed, ts: Date.now() / 1000 };
  };

  const readBridgeSerialLoop = async (port) => {
    if (!port?.readable) {
      setBridgeStatus('Port není čitelný');
      return;
    }

    const decoder = new TextDecoderStream();
    const pipePromise = port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();
    bridgeReaderRef.current = reader;
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += value;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          const parsed = parseSerialBridgeLine(line);
          if (parsed) {
            await processBridgeEvent(parsed);
          }
        }
      }
    } catch {
      // reader canceled or disconnected
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
      bridgeReaderRef.current = null;
      setBridgeConnected(false);
      setBridgeStatus('Odpojeno');
      try {
        await pipePromise;
      } catch {
        // ignore canceled pipe
      }
    }
  };

  const confirmBridgeEvent = async (eventId) => {
    const bridgeEvent = bridgeEvents.find((item) => item.id === eventId);
    if (!bridgeEvent || bridgeEvent.status === 'saved') return;
    if (!hasWriteLock) {
      setMessage({ type: 'warning', text: 'Tato karta je pouze pro čtení. Aktivní editace běží v jiné kartě.' });
      return;
    }

    const entry = startListById[bridgeEvent.selectedEntryId] || null;
    if (!entry) {
      updateBridgeEvent(eventId, {
        status: 'warning',
        level: 'warning',
        reason: 'bib_not_found',
      });
      return;
    }

    const entryId = entry.id;
    const currentDraft = editedTimesRef.current[entryId] || {
      time1: entry.time1 != null ? String(entry.time1) : '',
      time2: entry.time2 != null ? String(entry.time2) : '',
      dnf: Boolean(entry.dnf),
      dns: Boolean(entry.dns),
      dsq: Boolean(entry.dsq),
    };
    const nextDraft = { ...currentDraft };

    if (bridgeEvent.type === 'TIME') {
      const seconds = parseIncomingTime(bridgeEvent.time);
      if (seconds == null) {
        updateBridgeEvent(eventId, {
          status: 'warning',
          level: 'warning',
          reason: 'invalid_time',
        });
        return;
      }
      const field = bridgeEvent.targetRound === '2' ? 'time2' : 'time1';
      nextDraft[field] = seconds.toFixed(2);
      nextDraft.dnf = false;
      nextDraft.dns = false;
      nextDraft.dsq = false;
    } else {
      nextDraft.dns = bridgeEvent.type === 'DNS';
      nextDraft.dnf = bridgeEvent.type === 'DNF';
      nextDraft.dsq = bridgeEvent.type === 'DSQ';
    }

    setEditedTimes((prev) => ({ ...prev, [entryId]: nextDraft }));
    editedTimesRef.current = { ...editedTimesRef.current, [entryId]: nextDraft };

    updateBridgeEvent(eventId, { status: 'saving', level: 'info' });
    const ok = await saveEntry(entryId, nextDraft, 'Nepodařilo se uložit událost z bridge');
    updateBridgeEvent(eventId, {
      status: ok ? 'saved' : 'save_failed',
      level: ok ? 'success' : 'danger',
      racer: `${entry.racer_surname || ''} ${entry.racer_name || ''}`.trim(),
      selectedEntryId: entryId,
      reason: ok ? null : 'save_failed',
    });
  };

  const connectBridge = async () => {
    if (!bridgeSerialSupported) {
      setBridgeStatus('Web Serial není podporováno');
      return;
    }
    if (!bridgeCanUseSerial) {
      setBridgeStatus('Vyžaduje HTTPS nebo localhost');
      return;
    }
    if (!bridgePort) {
      setBridgeStatus('Nejprve vyberte port');
      return;
    }

    try {
      if (!bridgePort.readable) {
        await bridgePort.open({ baudRate: Number(bridgeBaud) || 9600 });
      }
      await bridgePort.setSignals({ dataTerminalReady: true, requestToSend: true });
      bridgeSerialPortRef.current = bridgePort;
      setBridgeConnected(true);
      setBridgeStatus('Připojeno');
      await readBridgeSerialLoop(bridgePort);
    } catch (err) {
      setBridgeConnected(false);
      setBridgeStatus(`Chyba: ${err?.message || 'nelze otevřít port'}`);
    }
  };

  const disconnectBridge = async () => {
    try {
      if (bridgeReaderRef.current) {
        await bridgeReaderRef.current.cancel();
      }
    } catch {
      // ignore
    }
    try {
      if (bridgeSerialPortRef.current) {
        await bridgeSerialPortRef.current.close();
      }
    } catch {
      // ignore
    }

    bridgeReaderRef.current = null;
    bridgeSerialPortRef.current = null;
    setBridgeConnected(false);
    setBridgeStatus('Odpojeno');
  };

  const chooseBridgePort = async () => {
    if (!bridgeSerialSupported || !bridgeCanUseSerial) return;
    try {
      const port = await navigator.serial.requestPort();
      setBridgePort(port);
      setBridgeStatus('Port vybrán');
    } catch {
      setBridgeStatus('Výběr portu zrušen');
    }
  };

  return (
    <div>
      {/* Header with save button */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div>
          <h5 className="fw-bold mb-0">
            <i className="bi bi-clock me-2" style={{ color: '#e94560' }}></i>
            Zadávání časů
          </h5>
          <small className="text-muted">Zapište časy jízd pro závodníky</small>
        </div>
        {startList.length > 0 && (
          <button
            className="btn btn-sm text-white"
            style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '8px' }}
            onClick={saveAllTimes}
            disabled={saving || !hasWriteLock}
          >
            {saving ? (
              <><span className="spinner-border spinner-border-sm me-1"></span>Ukládám...</>
            ) : (
              <><i className="bi bi-save me-1"></i>Uložit vše</>
            )}
          </button>
        )}
      </div>

      {!hasWriteLock && selectedRaceId && (
        <div className="alert alert-warning py-2 d-flex align-items-center small" role="alert">
          <i className="bi bi-lock-fill me-2"></i>
          Tato karta je pouze pro čtení. Editace probíhá v jiné otevřené kartě stejného závodu.
        </div>
      )}

      {selectedRaceId && (
        <div className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
          <div className="card-body py-2 px-3">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="fw-semibold" style={{ fontSize: '0.85rem', color: '#e94560' }}>
                  <i className="bi bi-usb-symbol me-1"></i>Přímé serial připojení
                </span>
                <select
                  className="form-select form-select-sm"
                  style={{ width: '110px' }}
                  value={bridgeBaud}
                  onChange={(e) => setBridgeBaud(e.target.value)}
                  disabled={bridgeConnected}
                >
                  {[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map((b) => (
                    <option key={b} value={String(b)}>{b}</option>
                  ))}
                </select>
                <button
                  className="btn btn-sm btn-outline-dark"
                  onClick={chooseBridgePort}
                  disabled={bridgeConnected || !bridgeSerialSupported || !bridgeCanUseSerial}
                >
                  Vybrat port
                </button>
                {!bridgeConnected ? (
                  <button className="btn btn-sm btn-outline-dark" onClick={connectBridge} disabled={!bridgePort || !bridgeSerialSupported || !bridgeCanUseSerial}>
                    Připojit
                  </button>
                ) : (
                  <button className="btn btn-sm btn-outline-danger" onClick={disconnectBridge}>
                    Odpojit
                  </button>
                )}
                <span className={`badge ${bridgeConnected ? 'bg-success' : 'bg-secondary'}`}>{bridgeStatus}</span>
                {!bridgeSerialSupported && <span className="badge bg-warning text-dark">Web Serial nepodporováno</span>}
                {bridgeSerialSupported && !bridgeCanUseSerial && <span className="badge bg-warning text-dark">Vyžaduje HTTPS/localhost</span>}
                {bridgePort && <span className="badge text-bg-light border">Port vybrán</span>}
                <span className="badge text-bg-light border">Inbox {pendingBridgeCount}</span>
                <span className="badge text-bg-light border">Vyřízeno {bridgeResolvedCount}</span>
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <small className="fw-semibold" style={{ color: '#e94560' }}>
                  <i className="bi bi-arrow-return-right me-1"></i>Cílové kolo:
                </small>
                <div className="btn-group btn-group-sm">
                  <button
                    className={`btn py-0 px-2 ${bridgeTargetRound === '1' ? '' : 'btn-outline-dark'}`}
                    style={{
                      fontSize: '0.75rem',
                      ...(bridgeTargetRound === '1' ? { background: '#e94560', color: 'white', border: 'none' } : {})
                    }}
                    onClick={() => setBridgeTargetRound('1')}
                  >
                    Kolo 1
                  </button>
                  <button
                    className={`btn py-0 px-2 ${bridgeTargetRound === '2' ? '' : 'btn-outline-dark'}`}
                    style={{
                      fontSize: '0.75rem',
                      ...(bridgeTargetRound === '2' ? { background: '#e94560', color: 'white', border: 'none' } : {})
                    }}
                    onClick={() => setBridgeTargetRound('2')}
                  >
                    Kolo 2
                  </button>
                </div>
                <small className="text-muted">Nové serial události se zařadí do zvoleného kola.</small>
              </div>
            </div>
            <small className="text-muted d-block mt-2">Formát: TIME;DRES;MM:SS.hh | DNS;DRES | DNF;DRES | DSQ;DRES. Nastavení portu najdete v menu Časomíra.</small>
          </div>
        </div>
      )}

      {/* Race info bar (static - no dropdown) */}
      {selectedRace ? (
        <div className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
          <div className="card-body py-2 px-3">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-trophy" style={{ color: '#e94560' }}></i>
                <span className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                  {selectedRace.raceNr || `#${selectedRace.id}`} — {selectedRace.areal_name || '?'}
                </span>
                <small className="text-muted">({formatDate(selectedRace.datum)})</small>
              </div>
              <div className="d-flex align-items-center gap-2">
                {/* Status filter */}
                {startList.length > 0 && (
                  <div className="btn-group btn-group-sm">
                    <button className={`btn py-0 px-2 ${filter === 'all' ? 'btn-dark' : 'btn-outline-dark'}`}
                      style={{ fontSize: '0.75rem' }} onClick={() => setFilter('all')}>
                      Vše ({categoryFiltered.length})
                    </button>
                    <button className={`btn py-0 px-2 ${filter === 'pending' ? 'btn-warning' : 'btn-outline-warning'}`}
                      style={{ fontSize: '0.75rem' }} onClick={() => setFilter('pending')}>
                      Čeká ({categoryFiltered.length - completedCount})
                    </button>
                    <button className={`btn py-0 px-2 ${filter === 'completed' ? 'btn-success' : 'btn-outline-success'}`}
                      style={{ fontSize: '0.75rem' }} onClick={() => setFilter('completed')}>
                      Hotovo ({completedCount})
                    </button>
                  </div>
                )}
                {/* Progress */}
                {startList.length > 0 && (
                  <div style={{ width: '80px' }}>
                    <div className="progress" style={{ height: '16px', borderRadius: '8px' }}>
                      <div className="progress-bar" style={{
                        width: `${categoryFiltered.length > 0 ? (completedCount / categoryFiltered.length * 100) : 0}%`,
                        background: 'linear-gradient(135deg, #e94560, #c23152)', borderRadius: '8px', fontSize: '0.65rem'
                      }}>
                        {categoryFiltered.length > 0 ? Math.round(completedCount / categoryFiltered.length * 100) : 0}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Race selector only when no race selected */
        <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '10px' }}>
          <div className="card-body py-2 px-3">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-trophy" style={{ color: '#e94560' }}></i>
              <select className="form-select form-select-sm" value={selectedRaceId}
                onChange={(e) => setSelectedRaceId(e.target.value)} style={{ borderRadius: '8px' }}>
                <option value="">-- Vyberte závod --</option>
                {races.map(race => (
                  <option key={race.id} value={race.id}>
                    {race.raceNr || `#${race.id}`} — {race.areal_name || '?'} ({formatDate(race.datum)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Category tabs + Round toggle row */}
      {!loading && selectedRaceId && startList.length > 0 && (
        <div className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
          <div className="card-body py-2 px-3">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              {/* Category pills */}
              <div className="d-flex align-items-center gap-1 flex-wrap">
                <small className="fw-semibold me-1" style={{ color: '#e94560' }}>
                  <i className="bi bi-tag me-1"></i>Kat:
                </small>
                <button
                  className={`btn py-0 px-2 ${selectedCategory === 'all' ? '' : 'btn-outline-dark'}`}
                  style={{
                    fontSize: '0.75rem', borderRadius: '12px',
                    ...(selectedCategory === 'all' ? { background: '#e94560', color: 'white', border: 'none' } : {})
                  }}
                  onClick={() => setSelectedCategory('all')}
                >
                  Vše ({startList.length})
                </button>
                {categoryList.map(cat => (
                  <button key={cat.name}
                    className={`btn py-0 px-2 ${selectedCategory === cat.name ? '' : 'btn-outline-dark'}`}
                    style={{
                      fontSize: '0.75rem', borderRadius: '12px',
                      ...(selectedCategory === cat.name ? { background: '#e94560', color: 'white', border: 'none' } : {})
                    }}
                    onClick={() => setSelectedCategory(cat.name)}
                  >
                    {cat.name} ({cat.count})
                  </button>
                ))}
              </div>

              {/* Round toggle */}
              <div className="d-flex align-items-center gap-2">
                <small className="fw-semibold" style={{ color: '#e94560' }}>
                  <i className="bi bi-toggles me-1"></i>Kolo:
                </small>
                <div className="btn-group btn-group-sm">
                  <button className={`btn py-0 px-2 ${activeRound === '1' ? '' : 'btn-outline-dark'}`}
                    style={{
                      fontSize: '0.75rem',
                      ...(activeRound === '1' ? { background: '#e94560', color: 'white', border: 'none' } : {})
                    }}
                    onClick={() => setActiveRound('1')}>1</button>
                  <button className={`btn py-0 px-2 ${activeRound === '2' ? '' : 'btn-outline-dark'}`}
                    style={{
                      fontSize: '0.75rem',
                      ...(activeRound === '2' ? { background: '#e94560', color: 'white', border: 'none' } : {})
                    }}
                    onClick={() => setActiveRound('2')}>2</button>
                  <button className={`btn py-0 px-2 ${activeRound === 'both' ? 'btn-dark' : 'btn-outline-dark'}`}
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => setActiveRound('both')}>Obě</button>
                </div>
                {activeRound !== 'both' && (
                  <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>
                    <i className="bi bi-lock me-1"></i>{activeRound === '1' ? 'K2 zamčeno' : 'K1 zamčeno'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className={`alert alert-${message.type} py-2 d-flex align-items-center small`} role="alert">
          <i className={`bi ${message.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
          {message.text}
          <button type="button" className="btn-close ms-auto" style={{ fontSize: '0.7rem' }} onClick={() => setMessage(null)}></button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-4">
          <div className="spinner-border spinner-border-sm" style={{ color: '#e94560' }}></div>
        </div>
      )}

      {!loading && selectedRaceId && (
        <div className="row g-3 align-items-start">
          <div className="col-12 col-xl-7">
            {filteredList.length > 0 ? (
              <div className="card border-0 shadow-sm" style={{ borderRadius: '10px' }}>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: '0.8rem' }}>
                      <thead style={{ background: '#1a1a2e', color: '#fff' }}>
                        <tr>
                          <th style={{ width: '60px', padding: '5px 6px', borderRadius: '10px 0 0 0' }}>Poř.</th>
                          <th style={{ width: '96px', padding: '5px 6px' }}>Dres</th>
                          <th style={{ minWidth: '170px', padding: '5px 6px' }}>Závodník</th>
                          <th style={{ width: '90px', padding: '5px 6px', ...(activeRound === '2' ? { opacity: 0.5 } : {}) }}>
                            J1 {activeRound === '2' && <i className="bi bi-lock-fill" style={{ fontSize: '0.6rem' }}></i>}
                          </th>
                          <th style={{ width: '90px', padding: '5px 6px', ...(activeRound === '1' ? { opacity: 0.5 } : {}) }}>
                            J2 {activeRound === '1' && <i className="bi bi-lock-fill" style={{ fontSize: '0.6rem' }}></i>}
                          </th>
                          <th style={{ width: '72px', padding: '5px 6px' }}>Součet</th>
                          <th style={{ width: '118px', padding: '5px 6px', borderRadius: '0 10px 0 0' }}>Stav</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredList.map((entry) => {
                          const times = editedTimes[entry.id] || {};
                          const hasFlag = times.dnf || times.dns || times.dsq;

                          return (
                            <tr key={entry.id} className={hasFlag ? 'table-light' : ''}>
                              <td className="fw-bold text-center" style={{ padding: '3px 6px' }}>{entry.start_number || '—'}</td>
                              <td style={{ padding: '3px 6px' }}>
                                <RaceNumberBadge
                                  actualNumber={entry.race_number_actual}
                                  displayNumber={entry.race_number_display}
                                  setColor={entry.set_color}
                                />
                              </td>
                              <td style={{ padding: '3px 6px' }}>
                                <div className="fw-semibold text-truncate">{entry.racer_surname} {entry.racer_name}</div>
                                <small className="text-muted d-block text-truncate">
                                  {entry.club_name || 'Bez klubu'}{selectedCategory === 'all' ? ` | ${entry.category_name || '?'}` : ''} ({entry.racer_year})
                                </small>
                              </td>
                              <td style={{ padding: '3px 4px' }}>
                                <input
                                  ref={el => inputRefs.current[`${entry.id}-time1`] = el}
                                  type="number" step="0.01" min="0"
                                  className="form-control form-control-sm"
                                  style={{
                                    borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.82rem', padding: '2px 4px',
                                    ...(activeRound === '2' ? { background: '#f0f0f0', opacity: 0.6 } : {})
                                  }}
                                  value={times.time1 || ''}
                                  onChange={(e) => updateTime(entry.id, 'time1', e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, entry.id, 'time1')}
                                  onBlur={() => handleBlur(entry.id, 'time1')}
                                  placeholder="0.00"
                                  disabled={hasFlag || activeRound === '2' || !hasWriteLock}
                                />
                              </td>
                              <td style={{ padding: '3px 4px' }}>
                                <input
                                  ref={el => inputRefs.current[`${entry.id}-time2`] = el}
                                  type="number" step="0.01" min="0"
                                  className="form-control form-control-sm"
                                  style={{
                                    borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.82rem', padding: '2px 4px',
                                    ...(activeRound === '1' ? { background: '#f0f0f0', opacity: 0.6 } : {})
                                  }}
                                  value={times.time2 || ''}
                                  onChange={(e) => updateTime(entry.id, 'time2', e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, entry.id, 'time2')}
                                  onBlur={() => handleBlur(entry.id, 'time2')}
                                  placeholder="0.00"
                                  disabled={hasFlag || activeRound === '1' || !hasWriteLock}
                                />
                              </td>
                              <td className="fw-bold text-center" style={{ padding: '3px 6px', fontFamily: 'monospace', fontSize: '0.86rem' }}>
                                {hasFlag
                                  ? (times.dnf ? <span className="badge bg-warning text-dark" style={{ fontSize: '0.68rem' }}>DNF</span>
                                    : times.dns ? <span className="badge bg-secondary" style={{ fontSize: '0.68rem' }}>DNS</span>
                                    : <span className="badge bg-danger" style={{ fontSize: '0.68rem' }}>DSQ</span>)
                                  : (entry.time_sum != null ? entry.time_sum.toFixed(2) : '—')}
                              </td>
                              <td style={{ padding: '3px 4px' }}>
                                <div className="btn-group btn-group-sm">
                                  <button className={`btn py-0 px-1 ${times.dnf ? 'btn-warning' : 'btn-outline-warning'}`}
                                    style={{ fontSize: '0.68rem', borderRadius: '6px 0 0 6px' }}
                                    onClick={() => toggleFlag(entry.id, 'dnf')}
                                    disabled={!hasWriteLock}
                                    title="Did Not Finish">DNF</button>
                                  <button className={`btn py-0 px-1 ${times.dns ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                    style={{ fontSize: '0.68rem' }}
                                    onClick={() => toggleFlag(entry.id, 'dns')}
                                    disabled={!hasWriteLock}
                                    title="Did Not Start">DNS</button>
                                  <button className={`btn py-0 px-1 ${times.dsq ? 'btn-danger' : 'btn-outline-danger'}`}
                                    style={{ fontSize: '0.68rem', borderRadius: '0 6px 6px 0' }}
                                    onClick={() => toggleFlag(entry.id, 'dsq')}
                                    disabled={!hasWriteLock}
                                    title="Disqualified">DSQ</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : startList.length === 0 ? (
              <div className="text-center py-4">
                <i className="bi bi-list-ul text-muted" style={{ fontSize: '2rem' }}></i>
                <p className="text-muted mt-2 mb-0 small">Startovní listina je prázdná</p>
                <a href="/timekeeper/start-list" className="btn btn-sm btn-outline-primary mt-2">
                  <i className="bi bi-list-ol me-1"></i>Přejít na startovní listinu
                </a>
              </div>
            ) : (
              <div className="text-center py-4">
                <i className="bi bi-check-circle text-success" style={{ fontSize: '2rem' }}></i>
                <p className="text-muted mt-2 small">Žádné záznamy pro vybraný filtr</p>
              </div>
            )}
          </div>

          <div className="col-12 col-xl-5">
            <div className="card border-0 shadow-sm" style={{ borderRadius: '10px' }}>
              <div className="card-body p-0">
                <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
                  <div>
                    <div className="fw-semibold" style={{ color: '#e94560', fontSize: '0.95rem' }}>
                      <i className="bi bi-journal-text me-1"></i>Serial inbox
                    </div>
                    <small className="text-muted">Klik na badge přepne kandidáta, potvrzení zapíše serial událost do výsledků.</small>
                  </div>
                  <span className="badge bg-dark">Kolo {bridgeTargetRound}</span>
                </div>

                <div style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                  {bridgeEvents.length === 0 ? (
                    <div className="text-center text-muted py-4 px-3 small">
                      Zatím nepřišla žádná serial událost.
                    </div>
                  ) : (
                    <div className="p-2">
                      {bridgeEvents.map((evt) => {
                        let candidates = (evt.candidateEntryIds || [])
                          .map((entryId) => startListById[entryId])
                          .filter(Boolean);
                        
                        // Fallback: if candidates were filtered out, rebuild from bib
                        if (candidates.length === 0 && evt.bib && startListById) {
                          const rebuiltCandidates = Object.values(startListById)
                            .filter((entry) => entry.race_number_actual === evt.bib)
                            .sort((a, b) => (a.start_number ?? 0) - (b.start_number ?? 0));
                          candidates = rebuiltCandidates;
                        }
                        
                        const selectedEntry = startListById[evt.selectedEntryId] || candidates[0] || null;
                        const statusClass = evt.status === 'saved'
                          ? 'success'
                          : evt.status === 'save_failed'
                            ? 'danger'
                            : evt.status === 'rejected'
                              ? 'secondary'
                              : evt.status === 'warning'
                                ? 'warning'
                                : 'light';

                        const isLockedRow = evt.status === 'saved' || evt.status === 'saving' || evt.status === 'rejected';
                        const canChangeCandidate = candidates.length > 1 && !isLockedRow;

                        return (
                          <div
                            key={evt.id}
                            className={`border rounded-2 px-2 py-1 mb-1 bg-${statusClass}${statusClass === 'light' ? '' : '-subtle'}`}
                            style={{ borderColor: evt.status === 'pending' ? '#e94560' : '#dee2e6' }}
                          >
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <small className="text-muted" style={{ width: '58px', fontSize: '0.7rem' }}>
                                {new Date(evt.ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </small>
                              <button
                                type="button"
                                className="btn btn-sm p-0 border-0"
                                onClick={() => cycleBridgeCandidate(evt.id)}
                                disabled={!canChangeCandidate}
                                title={canChangeCandidate ? 'Přepnout kandidáta/sadu' : 'Jen jedna shoda'}
                                style={{ height: '28px', width: '32px' }}
                              >
                                <span className="badge" style={{ ...getRaceNumberBadgeStyle(selectedEntry?.set_color ?? 'rose'), fontSize: '0.75rem' }}>
                                  {selectedEntry?.race_number_actual ?? evt.bib}
                                </span>
                              </button>
                              <small className="text-muted text-truncate" style={{ flex: 1, minWidth: 0, fontSize: '0.73rem' }}>
                                {evt.time ? `${evt.time}` : 'bez času'} | K{evt.targetRound || bridgeTargetRound}
                                {candidates.length > 1 ? ` | ${Math.max(candidates.findIndex((c) => c.id === selectedEntry?.id), 0) + 1}/${candidates.length}` : ''}
                                {evt.reason && evt.reason !== 'ready' && evt.reason !== 'multiple_matches' ? ` | ${formatBridgeReason(evt.reason)}` : ''}
                              </small>
                              <div className="d-flex gap-1 ms-auto">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-success py-0 px-2"
                                  style={{ fontSize: '0.85rem', lineHeight: '1' }}
                                  onClick={() => confirmBridgeEvent(evt.id)}
                                  disabled={!selectedEntry || isLockedRow}
                                  title="Přiřadit a uložit"
                                >
                                  ✓
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger py-0 px-2"
                                  style={{ fontSize: '0.85rem', lineHeight: '1' }}
                                  onClick={() => rejectBridgeEvent(evt.id)}
                                  disabled={isLockedRow}
                                  title="Zamítnout událost"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedRaceId && (
        <div className="text-center py-4">
          <i className="bi bi-hand-index text-muted" style={{ fontSize: '2rem' }}></i>
          <p className="text-muted mt-2 small">Vyberte závod pro zadávání časů</p>
        </div>
      )}
    </div>
  );
}
