import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TimekeeperAPI } from '../../config/timekeeperApi.js';
import { useConfirm } from '../../hooks/useConfirm.jsx';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { useRacePdf } from '../../hooks/useRacePdf.js';
import { dropRaceSnapshot } from '../../offline/startListCache.js';
import { clearTimingDrafts } from '../../offline/timingDrafts.js';
import { useSyncStatus } from '../../offline/useSyncStatus.js';
import { SELECTED_RACE_KEY, SelectedRaceBar, TimekeeperMessage, TK_ACCENT, TK_ACCENT_FILL, TK_ACCENT_GRADIENT, TK_ACCENT_TEXT } from './TimekeeperChrome.jsx';
import PdfPreviewModal from './PdfPreviewModal.jsx';
import StartListRow from './StartListRow.jsx';
import {
  OFFLINE_QUEUED_TEXT,
  activeEntries,
  categoryLabel,
  findRaceNumberOption,
  getRaceNumberValidationError,
  groupEntriesByCategory,
  isExcluded,
  resolveCategoryPreview,
  sortStartListEntries,
} from './startListHelpers.js';

/** Stejné pro všechny tabulky kategorií, aby sloupce seděly pod sebou. */
const START_LIST_TABLE_STYLE = Object.freeze({ fontSize: '0.82rem', tableLayout: 'fixed', minWidth: '920px' });

/**
 * Generování a ruční správa startovní listiny.
 *
 * Pravidla kolem startovních čísel a řazení jsou v `startListHelpers.js` -
 * stejná pravidla platí i na obrazovce Závodníci a rozcházet se nesmějí.
 */

// Kategorii dopočítává server podle ročníku a pohlaví, tohle je jen náhled.
const CATEGORY_PENDING_TEXT = 'Kategorie se dopočítá při uložení';

export default function StartListManager() {
  const { confirm, confirmElement } = useConfirm();
  const { isOnline, queueStats } = useSyncStatus();
  const [races, setRaces] = useState([]);
  const [selectedRaceId] = useState(
    localStorage.getItem(SELECTED_RACE_KEY) || ''
  );
  const [startList, setStartList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  // Generation setup state
  const [showGenerateSetup, setShowGenerateSetup] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [loadingSetup, setLoadingSetup] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editValidationError, setEditValidationError] = useState('');

  const [raceNumberOptions, setRaceNumberOptions] = useState([]);

  const pdf = useRacePdf(selectedRaceId);

  // Drží aktuální loadStartList, aby mazání závodníka nemuselo být závislé
  // na startList - jinak by se při každém úhozu měnila identita callbacku
  // a memoizované řádky by se překreslovaly všechny.
  const loadStartListRef = useRef(null);

  // Drag & drop refs
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  useEffect(() => { loadRaces(); }, []);

  useEffect(() => {
    if (selectedRaceId) {
      loadStartList();
      loadRaceNumberOptions();
      localStorage.setItem(SELECTED_RACE_KEY, selectedRaceId);
    }
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
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst startovní listinu' });
    } finally {
      setLoading(false);
    }
  };
  loadStartListRef.current = loadStartList;

  const loadRaceNumberOptions = async () => {
    try {
      const data = await TimekeeperAPI.get('/api/timekeeper/race-number-options');
      setRaceNumberOptions(data);
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst seznam závodních čísel' });
    }
  };

  const openGenerateSetup = async () => {
    try {
      setLoadingSetup(true);
      setShowGenerateSetup(true);
      const cats = await TimekeeperAPI.get('/api/timekeeper/categories');
      setCategories(cats);
      setCategoryOrder(cats.map(c => c.id));
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst nastavení' });
      setShowGenerateSetup(false);
    } finally {
      setLoadingSetup(false);
    }
  };

  const generateStartList = async () => {
    if (!selectedRaceId) return;
    try {
      setGenerating(true);
      const body = {};
      if (categoryOrder.length > 0) body.category_order = categoryOrder;
      const result = await TimekeeperAPI.post(
        `/api/timekeeper/races/${selectedRaceId}/start-list/generate`, body
      );
      setMessage({ type: 'success', text: result.message });
      setShowGenerateSetup(false);
      loadStartList();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Nepodařilo se vygenerovat startovní listinu' });
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Smazání celé startovní listiny.
   *
   * Jen online a jen s prázdnou frontou: offline by se smazání přehrálo se
   * zpožděním a vzalo s sebou i to, co mezitím vzniklo, a čekající zápis času
   * by po smazání skončil chybou.
   */
  const clearStartList = async () => {
    if (!selectedRaceId) return;

    if (!isOnline) {
      setMessage({
        type: 'warning',
        text: 'Mazání startovní listiny vyžaduje připojení k internetu - offline by se smazání přehrálo až později.'
      });
      return;
    }
    if (queueStats.total > 0) {
      setMessage({
        type: 'warning',
        text: `Ve frontě čeká ${queueStats.total} nesynchronizovaných změn. Nechte je nejdřív odeslat (Sync centrum).`
      });
      return;
    }

    const measured = startList.filter(
      (entry) => entry.time1 != null || entry.time2 != null || entry.dnf || entry.dns || entry.dsq
    ).length;

    const confirmed = await confirm({
      title: 'Smazat celou startovní listinu?',
      message: `Smaže se všech ${startList.length} závodníků včetně přidělených startovních čísel a dresů`
        + (measured > 0 ? ` a naměřených časů (${measured} závodníků už má výsledek)` : '')
        + '. Listinu půjde znovu vygenerovat z přihlášek. Akce je nevratná.',
      confirmLabel: 'Smazat vše',
      variant: 'danger',
      icon: 'bi-trash',
    });
    if (!confirmed) return;
    try {
      const result = await TimekeeperAPI.deleteOnline(
        `/api/timekeeper/races/${selectedRaceId}/start-list`
      );
      // Nakešovaná startovka i rozepsané časy musí zmizet s ní - jinak si je
      // obrazovka Zadávání časů offline načte jako platné.
      await dropRaceSnapshot(selectedRaceId);
      await clearTimingDrafts(selectedRaceId);
      setMessage({ type: 'info', text: result.message });
      setStartList([]);
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err.message || 'Nepodařilo se smazat startovní listinu'
      });
    }
  };

  // --- Inline editing ---
  const startEditing = useCallback((entry) => {
    setEditingId(entry.id);
    setEditForm({
      start_number: entry.start_number || '',
      racer_name: entry.racer_name || '',
      racer_surname: entry.racer_surname || '',
      racer_year: entry.racer_year || '',
      racer_sex: entry.racer_sex || '',
      club_name: entry.club_name || '',
      race_number_display: entry.race_number_display || '',
    });
    setEditValidationError('');
  }, []);

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
    setEditValidationError('');
  };

  const validateRaceNumber = useCallback((displayNumber, excludeEntryId = null) => (
    getRaceNumberValidationError(displayNumber, {
      options: raceNumberOptions,
      entries: startList,
      excludeEntryId,
    })
  ), [raceNumberOptions, startList]);

  const categoryPreview = (year, sex) => (
    resolveCategoryPreview(categories, year, sex, CATEGORY_PENDING_TEXT, 'Bez kategorie')
  );

  const saveEditing = async () => {
    if (!editingId) return;

    const raceNumberError = validateRaceNumber(editForm.race_number_display, editingId);
    if (raceNumberError) {
      setEditValidationError(raceNumberError);
      return;
    }

    try {
      const body = {};
      if (editForm.start_number !== '') body.start_number = parseInt(editForm.start_number);
      body.racer_name = editForm.racer_name?.trim() || null;
      body.racer_surname = editForm.racer_surname?.trim() || null;
      body.club_name = editForm.club_name?.trim() || null;
      body.racer_year = editForm.racer_year !== '' && editForm.racer_year !== null && editForm.racer_year !== undefined
        ? parseInt(editForm.racer_year)
        : null;
      body.race_number_display = editForm.race_number_display !== '' ? parseInt(editForm.race_number_display) : null;

      const result = await TimekeeperAPI.put(`/api/timekeeper/start-list/${editingId}`, body);
      if (result?.entry) {
        setStartList(prev => sortStartListEntries(prev.map(entry => (
          entry.id === editingId ? result.entry : entry
        ))));
      } else {
        // Offline: požadavek leží ve frontě a žádný `entry` se nevrátil, takže
        // řádek přepíšeme tím, co jsme odeslali, a označíme ho jako nesynchronizovaný.
        setStartList(prev => sortStartListEntries(prev.map(entry => (
          entry.id === editingId ? { ...entry, ...body, pending_sync: true } : entry
        ))));
        setMessage({ type: 'info', text: result?.message || OFFLINE_QUEUED_TEXT });
      }
      setEditingId(null);
      setEditForm({});
      setEditValidationError('');
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se uložit změny' });
    }
  };

  const deleteEntry = useCallback(async (entryId, name) => {
    const confirmed = await confirm({
      title: `Odebrat ${name} ze startovní listiny?`,
      confirmLabel: 'Odebrat',
      variant: 'danger',
      icon: 'bi-trash',
    });
    if (!confirmed) return;
    try {
      await TimekeeperAPI.delete(`/api/timekeeper/start-list/${entryId}`);
      await loadStartListRef.current();
      setMessage({ type: 'info', text: `${name} odebrán/a ze startovní listiny` });
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se odebrat závodníka' });
    }
  }, [confirm]);

  /**
   * Vyřazení ze startky / vrácení zpět (nedorazil, nestihl start).
   *
   * Jde přes offline frontu jako každá jiná úprava startovky: bez signálu se
   * změna uloží v zařízení a obrazovky (Časy, tisk) ji vidí hned. Posílá se
   * cílový stav, ne přepínač, takže opakovaná přehrávka nic neotočí.
   */
  const toggleExcluded = useCallback(async (entry) => {
    const excluded = !isExcluded(entry);
    const name = `${entry.racer_surname} ${entry.racer_name}`.trim();
    try {
      const result = await TimekeeperAPI.put(`/api/timekeeper/start-list/${entry.id}/excluded`, { excluded });
      if (result?.entry) {
        setStartList(prev => prev.map(item => (item.id === entry.id ? result.entry : item)));
        setMessage({
          type: 'info',
          text: excluded
            ? `${name} vyřazen/a ze startovní listiny. Vrátit jde tlačítkem Vrátit.`
            : `${name} vrácen/a na startovní listinu.`
        });
      } else {
        // Offline: zápis čeká ve frontě a řádek se upraví podle odeslaného stavu.
        setStartList(prev => prev.map(item => (
          item.id === entry.id ? { ...item, excluded, pending_sync: true } : item
        )));
        setMessage({ type: 'info', text: result?.message || OFFLINE_QUEUED_TEXT });
      }
    } catch {
      setMessage({
        type: 'danger',
        text: excluded ? `Nepodařilo se vyřadit ${name}` : `Nepodařilo se vrátit ${name}`
      });
    }
  }, []);

  const liveEditRaceNumberError = useMemo(() => (
    editingId ? validateRaceNumber(editForm.race_number_display, editingId) : ''
  ), [editingId, editForm.race_number_display, validateRaceNumber]);

  // --- Drag & drop ---
  const handleDragStart = (index) => { dragItem.current = index; };
  const handleDragEnter = (index) => { dragOverItem.current = index; };
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const newOrder = [...categoryOrder];
    const draggedItemId = newOrder[dragItem.current];
    newOrder.splice(dragItem.current, 1);
    newOrder.splice(dragOverItem.current, 0, draggedItemId);
    setCategoryOrder(newOrder);
    dragItem.current = null;
    dragOverItem.current = null;
  };
  const moveCategoryUp = (index) => {
    if (index === 0) return;
    const n = [...categoryOrder];
    [n[index - 1], n[index]] = [n[index], n[index - 1]];
    setCategoryOrder(n);
  };
  const moveCategoryDown = (index) => {
    if (index === categoryOrder.length - 1) return;
    const n = [...categoryOrder];
    [n[index], n[index + 1]] = [n[index + 1], n[index]];
    setCategoryOrder(n);
  };

  const getCategoryById = (id) => categories.find(c => c.id === id);
  const selectedRace = races.find(r => String(r.id) === String(selectedRaceId));

  // Group by category — use array to preserve start_number order.
  // Vyřazení zůstávají v tabulce své kategorie - jen tady se dají vrátit.
  // Počty jsou za ty, kdo na startovce opravdu jsou; vyřazení se hlásí zvlášť.
  const groupedByCategory = useMemo(() => groupEntriesByCategory(startList).map((group) => {
    const groupActiveCount = activeEntries(group.entries).length;
    return { ...group, activeCount: groupActiveCount, excludedCount: group.entries.length - groupActiveCount };
  }), [startList]);
  const activeCount = useMemo(() => activeEntries(startList).length, [startList]);
  const excludedCount = startList.length - activeCount;

  /** Celková startovní listina do PDF - všechny kategorie v pořadí startu, bez vyřazených. */
  const printStartList = async () => {
    const categories = groupEntriesByCategory(activeEntries(startList));
    if (categories.length === 0) {
      setMessage({ type: 'warning', text: 'Na startovní listině nikdo není - všichni závodníci jsou vyřazení.' });
      return;
    }
    try {
      await pdf.generateStartList({ categories });
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se vytvořit PDF' });
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="fw-bold mb-0">
            <i className="bi bi-list-ol me-2" style={{ color: TK_ACCENT }}></i>
            Startovní listina
          </h5>
          <small className="text-muted">Generování a správa startovní listiny</small>
        </div>
      </div>

      {/* Race selector */}
      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '10px' }}>
        <div className="card-body py-2 px-3">
          <div className="row align-items-center g-2">
            <div className="col-md-5">
              <SelectedRaceBar race={selectedRace} />
            </div>
            {selectedRace && (
              <div className="col-md-7">
                <div className="d-flex gap-2 justify-content-end flex-wrap">
                  <button
                    className="btn btn-sm text-white"
                    style={{ background: TK_ACCENT_GRADIENT, border: 'none', borderRadius: '8px' }}
                    onClick={showGenerateSetup ? () => setShowGenerateSetup(false) : openGenerateSetup}
                    disabled={generating}
                  >
                    <i className={`bi ${showGenerateSetup ? 'bi-x-lg' : 'bi-plus-circle'} me-1`}></i>
                    {showGenerateSetup ? 'Zrušit' : 'Generovat'}
                  </button>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    style={{ borderRadius: '8px' }}
                    onClick={() => navigate('/timekeeper/racers')}
                  >
                    <i className="bi bi-people me-1"></i>Závodníci
                  </button>
                  {startList.length > 0 && (
                    <>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        style={{ borderRadius: '8px' }}
                        onClick={printStartList}
                        disabled={pdf.generating}
                        title="Celková startovní listina všech kategorií - funguje i offline"
                      >
                        {pdf.generating ? <ButtonSpinner /> : <i className="bi bi-printer me-1"></i>}
                        Tisk startovky
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        style={{ borderRadius: '8px' }}
                        onClick={clearStartList}
                      >
                        <i className="bi bi-trash me-1"></i>Smazat vše
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generation setup panel */}
      {showGenerateSetup && (
        <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '10px', borderTop: '3px solid #e94560' }}>
          <div className="card-body py-3 px-3">
            {loadingSetup ? (
              <LoadingState variant="timekeeper" label="Načítám nastavení..." />
            ) : (
              <>
                <h6 className="fw-bold mb-2">
                  <i className="bi bi-gear me-2"></i>Nastavení generování
                </h6>
                <div className="row g-3">
                  {/* Category ordering */}
                  <div className="col-12">
                    <div className="p-2 rounded-2" style={{ background: '#f8f9fa' }}>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="fw-bold">
                          <i className="bi bi-arrow-down-up me-1" style={{ color: TK_ACCENT }}></i>Pořadí kategorií
                        </small>
                        <small className="text-muted"><i className="bi bi-grip-vertical me-1"></i>Přetáhněte</small>
                      </div>
                      <div className="d-flex flex-column gap-1">
                        {categoryOrder.map((catId, index) => {
                          const cat = getCategoryById(catId);
                          if (!cat) return null;
                          return (
                            <div key={catId} draggable
                              onDragStart={() => handleDragStart(index)}
                              onDragEnter={() => handleDragEnter(index)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => e.preventDefault()}
                              className="d-flex align-items-center py-1 px-2 rounded-2"
                              style={{ background: 'white', border: '1px solid #dee2e6', cursor: 'grab', userSelect: 'none', fontSize: '0.85rem' }}
                            >
                              <i className="bi bi-grip-vertical text-muted me-2"></i>
                              <span className="badge me-2" style={{ background: TK_ACCENT_FILL, minWidth: '22px', fontSize: '0.7rem' }}>{index + 1}</span>
                              <span className="fw-semibold flex-grow-1">{categoryLabel(cat)}</span>
                              {cat.code && (
                                <small className="text-muted me-2" title="Kódové označení kategorie">{cat.code}</small>
                              )}
                              <small className="text-muted me-2">{cat.sex === 2 ? '♀' : '♂'}</small>
                              <div className="btn-group btn-group-sm">
                                <button className="btn btn-outline-secondary py-0 px-1" style={{ fontSize: '0.7rem' }}
                                  onClick={(e) => { e.stopPropagation(); moveCategoryUp(index); }} disabled={index === 0}>
                                  <i className="bi bi-chevron-up"></i>
                                </button>
                                <button className="btn btn-outline-secondary py-0 px-1" style={{ fontSize: '0.7rem' }}
                                  onClick={(e) => { e.stopPropagation(); moveCategoryDown(index); }} disabled={index === categoryOrder.length - 1}>
                                  <i className="bi bi-chevron-down"></i>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 d-flex justify-content-end">
                  <button className="btn btn-sm text-white px-3"
                    style={{ background: TK_ACCENT_GRADIENT, border: 'none', borderRadius: '8px' }}
                    onClick={generateStartList}
                    disabled={generating}>
                    {generating ? (
                      <><ButtonSpinner />Generuji...</>
                    ) : (
                      <><i className="bi bi-lightning me-1"></i>Vygenerovat</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <TimekeeperMessage message={message} onDismiss={() => setMessage(null)} />

      {loading && <LoadingState variant="timekeeper" />}

      {/* Start list */}
      {!loading && selectedRaceId && startList.length > 0 && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <small className="fw-semibold">
              Závodníků: <span style={{ color: TK_ACCENT_TEXT }}>{activeCount}</span>
              {excludedCount > 0 && (
                <span className="text-muted fw-normal ms-2">(vyřazeno: {excludedCount})</span>
              )}
            </small>
            <button className="btn btn-sm btn-primary" style={{ borderRadius: '8px' }}
              onClick={() => navigate('/timekeeper/timing')}>
              <i className="bi bi-clock me-1"></i>Zadávání časů
            </button>
          </div>

          {groupedByCategory.map(group => (
            <div key={group.key} className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
              <div className="card-header bg-white py-2 px-3 border-bottom" style={{ borderRadius: '10px 10px 0 0' }}>
                <small className="fw-bold">
                  <i className="bi bi-tag-fill me-1" style={{ color: TK_ACCENT }}></i>
                  {group.category_name}
                  <span className="badge bg-secondary ms-1" style={{ fontSize: '0.65rem' }}>{group.activeCount}</span>
                  {group.excludedCount > 0 && (
                    <span className="text-muted fw-normal ms-2">vyřazeno: {group.excludedCount}</span>
                  )}
                </small>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  {/* Každá kategorie je samostatná tabulka. Pevné rozložení se
                      stejnými šířkami drží sloupce pod sebou napříč kategoriemi -
                      automatické by je rozpočítalo podle obsahu každé tabulky
                      zvlášť. Šířky počítají i s poli při úpravě řádku. */}
                  <table className="table table-sm table-hover mb-0 align-middle" style={START_LIST_TABLE_STYLE}>
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '64px', padding: '4px 8px' }}>Pořadí</th>
                        <th style={{ width: '104px', padding: '4px 8px' }}>St. číslo</th>
                        <th style={{ padding: '4px 8px' }}>Závodník</th>
                        <th style={{ width: '72px', padding: '4px 8px' }}>Roč.</th>
                        <th style={{ width: '22%', padding: '4px 8px' }}>Klub</th>
                        <th style={{ width: '68px', padding: '4px 8px' }}>Čas 1</th>
                        <th style={{ width: '68px', padding: '4px 8px' }}>Čas 2</th>
                        <th style={{ width: '68px', padding: '4px 8px' }}>Součet</th>
                        <th style={{ width: '136px', padding: '4px 8px' }}>Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.entries.map(entry => (
                        editingId === entry.id ? (
                          <tr key={entry.id} style={{ background: '#fffbea' }}>
                            <td style={{ padding: '4px 8px' }}>
                              <input type="number" className="form-control form-control-sm"
                                style={{ width: '45px', fontSize: '0.8rem', padding: '2px 4px' }}
                                value={editForm.start_number}
                                onChange={(e) => setEditForm(p => ({ ...p, start_number: e.target.value }))}
                              />
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <input type="number" className={`form-control form-control-sm ${(liveEditRaceNumberError || editValidationError) ? 'is-invalid' : ''}`}
                                style={{ width: '78px', fontSize: '0.8rem', padding: '2px 4px' }}
                                value={editForm.race_number_display}
                                onChange={(e) => { setEditForm(p => ({ ...p, race_number_display: e.target.value })); setEditValidationError(''); }}
                                placeholder="St. číslo"
                              />
                              <small className="text-muted d-block mt-1">
                                Číslo dresu: {findRaceNumberOption(raceNumberOptions, editForm.race_number_display)?.actual_number ?? entry.race_number_actual ?? '—'}
                              </small>
                              {(liveEditRaceNumberError || editValidationError) && (
                                <div className="invalid-feedback d-block">{liveEditRaceNumberError || editValidationError}</div>
                              )}
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <div className="d-flex gap-1">
                                <input type="text" className="form-control form-control-sm"
                                  style={{ fontSize: '0.8rem', padding: '2px 4px' }}
                                  placeholder="Jméno" value={editForm.racer_name}
                                  onChange={(e) => setEditForm(p => ({ ...p, racer_name: e.target.value }))}
                                />
                                <input type="text" className="form-control form-control-sm"
                                  style={{ fontSize: '0.8rem', padding: '2px 4px' }}
                                  placeholder="Příjmení" value={editForm.racer_surname}
                                  onChange={(e) => setEditForm(p => ({ ...p, racer_surname: e.target.value }))}
                                />
                              </div>
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <input type="number" className="form-control form-control-sm"
                                style={{ width: '55px', fontSize: '0.8rem', padding: '2px 4px' }}
                                value={editForm.racer_year}
                                onChange={(e) => setEditForm(p => ({ ...p, racer_year: e.target.value }))}
                              />
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <input type="text" className="form-control form-control-sm"
                                style={{ fontSize: '0.8rem', padding: '2px 4px' }}
                                value={editForm.club_name}
                                onChange={(e) => setEditForm(p => ({ ...p, club_name: e.target.value }))}
                                placeholder="Klub"
                              />
                            </td>
                            <td colSpan="3" style={{ padding: '4px 8px' }}>
                              <div className="small text-muted">
                                Kategorie po uložení: <strong>{categoryPreview(editForm.racer_year, editForm.racer_sex)}</strong>
                              </div>
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <div className="d-flex gap-1">
                                <button className="btn btn-sm btn-success py-0 px-1" style={{ fontSize: '0.75rem' }}
                                  onClick={saveEditing} title="Uložit">
                                  <i className="bi bi-check-lg"></i>
                                </button>
                                <button className="btn btn-sm btn-outline-secondary py-0 px-1" style={{ fontSize: '0.75rem' }}
                                  onClick={cancelEditing} title="Zrušit">
                                  <i className="bi bi-x-lg"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <StartListRow
                            key={entry.id}
                            entry={entry}
                            onEdit={startEditing}
                            onDelete={deleteEntry}
                            onToggleExcluded={toggleExcluded}
                          />
                        )
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && selectedRaceId && startList.length === 0 && !showGenerateSetup && (
        <EmptyState
          icon="bi-list-ul"
          title="Startovní listina je prázdná"
          hint='Klikněte na "Generovat" pro vytvoření listiny'
        />
      )}

      {!selectedRaceId && <EmptyState icon="bi-hand-index" title="Vyberte závod" />}

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
