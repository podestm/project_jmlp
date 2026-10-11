import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TimekeeperAPI } from '../../config/timekeeperApi.js';
import RegistrationFormFields from '../ui/registration/RegistrationFormFields.jsx';
import RacerSearchResults from '../ui/registration/RacerSearchResults.jsx';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { readSelectedRaceId, storeSelectedRaceId } from './frame/selectedRace.js';
import { SelectedRaceBar, TK_ACCENT, TK_ACCENT_GRADIENT } from './TimekeeperChrome.jsx';
import TimekeeperMessage from './TimekeeperMessage.jsx';
import TimekeeperRacerRow, { getSexLabel } from './TimekeeperRacerRow.jsx';
import {
  OFFLINE_QUEUED_TEXT,
  findRaceNumberOption,
  getRaceNumberValidationError,
  resolveCategoryPreview,
  sortStartListEntries,
} from './startListHelpers.js';
import { getRaceNumberBadgeStyle, getSetColorTheme } from '../../utils/raceNumbers.js';
import Icon from '../ms/Icon/Icon.jsx';

/**
 * Závodníci jednoho závodu - přidání a inline oprava bez zápisu do registrací.
 *
 * Pravidla startovních čísel, řazení listiny i náhled kategorie jsou ve
 * `startListHelpers.js` - platí i na obrazovce Startovní listina a rozejít se
 * nesmějí, jinak by každá obrazovka hlásila jiný konflikt čísel.
 */

// Kategorii dopočítává server podle ročníku a pohlaví, tohle je jen náhled.
const CATEGORY_PENDING_TEXT = 'Kategorie se dopočítá při přidání';

const createEmptyForm = (raceNumberDisplay = '') => ({
  name: '',
  surname: '',
  year: '',
  sex: '',
  club: '',
  telefon: '',
  email: '',
  slcr_id: '',
  race_number_display: raceNumberDisplay,
});

export default function TimekeeperRacers() {
  const navigate = useNavigate();
  const [races, setRaces] = useState([]);
  const [selectedRaceId] = useState(readSelectedRaceId);
  const [startList, setStartList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clubs, setClubs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRacer, setSelectedRacer] = useState(null);
  const [raceNumberOptions, setRaceNumberOptions] = useState([]);
  const [formData, setFormData] = useState(createEmptyForm());
  const [filters, setFilters] = useState({
    club: 'all',
    category: 'all',
    sex: 'all',
    text: '',
  });

  // Inline editing state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editValidationError, setEditValidationError] = useState('');

  const getNextAvailableRaceNumberDisplay = (entries = startList) => {
    const assigned = entries
      .map(entry => entry.race_number_display)
      .filter(value => value !== null && value !== undefined)
      .map(value => Number(value))
      .filter(value => Number.isFinite(value));

    if (assigned.length === 0) {
      return raceNumberOptions.length > 0 ? String(raceNumberOptions[0].display_number) : '';
    }

    const candidate = Math.max(...assigned) + 1;
    const exactOption = raceNumberOptions.find(option => Number(option.display_number) === candidate);
    return exactOption ? String(exactOption.display_number) : '';
  };

  const resetForm = (entries = startList) => {
    setFormData(createEmptyForm(getNextAvailableRaceNumberDisplay(entries)));
    setSelectedRacer(null);
    setSearchResults([]);
  };

  useEffect(() => {
    loadRaces();
    loadClubs();
    loadCategories();
    loadRaceNumberOptions();
  }, []);

  useEffect(() => {
    if (!selectedRaceId) return;
    storeSelectedRaceId(selectedRaceId);
    loadStartList(selectedRaceId);
  }, [selectedRaceId]);

  useEffect(() => {
    if (!selectedRaceId || selectedRacer) return;
    if (formData.race_number_display) return;
    if (formData.name || formData.surname || formData.year || formData.sex || formData.club || formData.slcr_id) return;

    const proposal = getNextAvailableRaceNumberDisplay();
    if (!proposal) return;

    setFormData(prev => ({ ...prev, race_number_display: proposal }));
  }, [selectedRaceId, raceNumberOptions, startList]);

  useEffect(() => {
    const query = [
      formData.slcr_id?.trim(),
      `${formData.surname || ''} ${formData.name || ''}`.trim(),
      formData.surname?.trim(),
      formData.name?.trim(),
    ].find(Boolean);

    if (!query || query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return undefined;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await TimekeeperAPI.get('/api/timekeeper/racers/search', { q: query });
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [formData.name, formData.surname, formData.slcr_id]);

  const loadRaces = async () => {
    try {
      const data = await TimekeeperAPI.get('/api/timekeeper/races');
      setRaces(data);
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst závody' });
    }
  };

  // Kluby jdou přes TimekeeperAPI jako zbytek obrazovky, aby byly offline
  // v IndexedDB. Veřejný klient je dřív měl offline jen díky keši service
  // workeru, který už data nekešuje (viz public/sw.js).
  const loadClubs = async () => {
    try {
      const data = await TimekeeperAPI.get('/clubs/');
      setClubs(data);
    } catch {
      setClubs([]);
    }
  };

  const loadRaceNumberOptions = async () => {
    try {
      const data = await TimekeeperAPI.get('/api/timekeeper/race-number-options');
      setRaceNumberOptions(data);
    } catch {
      setRaceNumberOptions([]);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await TimekeeperAPI.get('/api/timekeeper/categories');
      setCategories(data);
    } catch {
      setCategories([]);
    }
  };

  const loadStartList = async (raceId) => {
    try {
      setLoading(true);
      const data = await TimekeeperAPI.get(`/api/timekeeper/races/${raceId}/start-list`);
      const sorted = sortStartListEntries(data);
      setStartList(sorted);
      resetForm(sorted);
      setFilters({ club: 'all', category: 'all', sex: 'all', text: '' });
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst závodníky závodu' });
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'name' || field === 'surname' || field === 'slcr_id') {
      setSelectedRacer(null);
    }
    setMessage(null);
  };

  const selectExistingRacer = (racer) => {
    setSelectedRacer(racer);
    setFormData(prev => ({
      ...prev,
      name: racer.name || '',
      surname: racer.surname || '',
      year: racer.year || '',
      sex: racer.sex || '',
      club: racer.club_name || '',
      slcr_id: racer.slcr_id || '',
      race_number_display: prev.race_number_display,
    }));
    setMessage(null);
  };

  // Stabilní identita callbacku, aby memoizované řádky nepřekreslovala každá
  // změna formuláře nahoře. `excludeEntryId` je editovaný záznam - vlastní
  // číslo si sám sobě konfliktovat nesmí.
  const validateRaceNumber = useCallback((displayNumber, excludeEntryId = null) => (
    getRaceNumberValidationError(displayNumber, {
      options: raceNumberOptions,
      entries: startList,
      excludeEntryId,
    })
  ), [raceNumberOptions, startList]);

  const categoryPreview = (year, sex) => (
    resolveCategoryPreview(categories, year, sex, CATEGORY_PENDING_TEXT)
  );

  // --- Inline editing ---
  const startEditing = useCallback((entry) => {
    setEditingId(entry.id);
    setEditForm({
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

  const saveEditing = async () => {
    if (!editingId) return;

    const raceNumberError = validateRaceNumber(editForm.race_number_display, editingId);
    if (raceNumberError) {
      setEditValidationError(raceNumberError);
      return;
    }

    try {
      const body = {};
      body.racer_name = editForm.racer_name?.trim() || null;
      body.racer_surname = editForm.racer_surname?.trim() || null;
      body.club_name = editForm.club_name?.trim() || null;
      body.racer_year = editForm.racer_year !== '' && editForm.racer_year != null
        ? parseInt(editForm.racer_year) : null;
      body.racer_sex = editForm.racer_sex !== '' && editForm.racer_sex != null
        ? parseInt(editForm.racer_sex) : null;
      body.race_number_display = editForm.race_number_display !== '' && editForm.race_number_display != null
        ? parseInt(editForm.race_number_display) : null;

      const result = await TimekeeperAPI.put(`/api/timekeeper/start-list/${editingId}`, body);

      if (result?.entry) {
        setStartList(prev => sortStartListEntries(prev.map(entry => (
          entry.id === editingId ? result.entry : entry
        ))));
        setMessage({ type: 'success', text: 'Závodník upraven' });
      } else {
        // Offline: server žádný `entry` nevrátil, změna leží ve frontě. Řádek
        // proto přepíšeme odeslanými hodnotami, ať rozhodčí vidí, co zapsal.
        setStartList(prev => sortStartListEntries(prev.map(entry => (
          entry.id === editingId ? { ...entry, ...body, pending_sync: true } : entry
        ))));
        setMessage({ type: 'info', text: result?.message || OFFLINE_QUEUED_TEXT });
      }

      setEditingId(null);
      setEditForm({});
      setEditValidationError('');
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Nepodařilo se uložit změny' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRaceId) return;

    if (!formData.name.trim() || !formData.surname.trim() || !formData.year || !formData.sex || !formData.club.trim()) {
      setMessage({ type: 'danger', text: 'Vyplňte jméno, příjmení, rok narození, pohlaví a oddíl' });
      return;
    }

    const raceNumberError = validateRaceNumber(formData.race_number_display);
    if (raceNumberError) {
      setMessage({ type: 'danger', text: raceNumberError });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        racer_name: formData.name.trim(),
        racer_surname: formData.surname.trim(),
        racer_year: Number(formData.year),
        racer_sex: Number(formData.sex),
        club_name: formData.club.trim(),
      };

      if (selectedRacer?.id) payload.racer_id = selectedRacer.id;
      if (formData.telefon.trim()) payload.racer_telefon = formData.telefon.trim();
      if (formData.email.trim()) payload.racer_email = formData.email.trim();
      if (formData.slcr_id.trim()) payload.racer_slcr_id = formData.slcr_id.trim();
      if (formData.race_number_display) payload.race_number_display = Number(formData.race_number_display);

      const result = await TimekeeperAPI.post(
        `/api/timekeeper/races/${selectedRaceId}/start-list/entry`,
        payload
      );

      // Offline zápis nemá `entry` - kategorii ani startovní číslo přiděluje
      // server, takže do listiny nic nedopisujeme, jen uklidíme formulář.
      if (!result?.entry) {
        resetForm(startList);
        setMessage({ type: 'info', text: 'Závodník bude přidán po obnovení připojení.' });
        return;
      }

      const updatedEntries = sortStartListEntries([...startList, result.entry]);
      setStartList(updatedEntries);
      resetForm(updatedEntries);
      setMessage({ type: 'success', text: result.message });
    } catch (err) {
      // Server říká česky, co je špatně (např. že závodník už na startovce je,
      // jen vyřazený, a má se vrátit v Listině) - to je užitečnější než kód chyby.
      const detail = typeof err?.detail === 'string' ? err.detail : null;
      setMessage({ type: 'danger', text: detail || err.message || 'Nepodařilo se přidat závodníka do závodu' });
    } finally {
      setSubmitting(false);
    }
  };

  const clubOptions = useMemo(() => (
    [...new Set(startList.map(entry => entry.club_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs'))
  ), [startList]);

  const categoryOptions = useMemo(() => (
    [...new Map(startList.map(entry => [entry.category_id || `none-${entry.category_name}`, entry.category_name || 'Bez kategorie'])).values()]
  ), [startList]);

  const filteredEntries = useMemo(() => (
    startList.filter(entry => {
      if (filters.club !== 'all' && (entry.club_name || 'Bez oddílu') !== filters.club) return false;
      if (filters.category !== 'all' && (entry.category_name || 'Bez kategorie') !== filters.category) return false;
      if (filters.sex !== 'all' && String(entry.racer_sex) !== filters.sex) return false;

      const haystack = [
        entry.racer_name,
        entry.racer_surname,
        entry.club_name,
        entry.category_name,
        entry.race_number_display,
        entry.race_number_actual,
        entry.start_number,
      ].join(' ').toLowerCase();

      if (filters.text.trim() && !haystack.includes(filters.text.trim().toLowerCase())) return false;
      return true;
    })
  ), [startList, filters]);

  const selectedRace = races.find(race => String(race.id) === String(selectedRaceId));
  const liveRaceNumberError = useMemo(
    () => validateRaceNumber(formData.race_number_display),
    [validateRaceNumber, formData.race_number_display]
  );
  const selectedRaceNumberOption = useMemo(
    () => findRaceNumberOption(raceNumberOptions, formData.race_number_display),
    [raceNumberOptions, formData.race_number_display]
  );
  const selectedRaceNumberTheme = getSetColorTheme(selectedRaceNumberOption?.set_color);
  const liveEditRaceNumberError = useMemo(
    () => (editingId ? validateRaceNumber(editForm.race_number_display, editingId) : ''),
    [validateRaceNumber, editingId, editForm.race_number_display]
  );

  return (
    <div>
      <style>{`@layer legacy {
        .timekeeper-racers-panel .form-label {
          font-size: 0.78rem;
          margin-bottom: 0.2rem;
        }
        .timekeeper-racers-panel .registration-input,
        .timekeeper-racers-panel .registration-select,
        .timekeeper-racers-panel .form-control,
        .timekeeper-racers-panel .form-select {
          min-height: 34px;
          padding: 0.3rem 0.5rem;
          font-size: 0.86rem;
        }
        .timekeeper-racers-panel .list-group-item {
          padding: 0.45rem 0.6rem !important;
        }
        .timekeeper-racers-table {
          font-size: 0.8rem;
        }
        .timekeeper-racers-table th,
        .timekeeper-racers-table td {
          padding: 0.35rem 0.5rem;
          line-height: 1.2;
          vertical-align: middle;
        }
        .timekeeper-racers-table .badge {
          font-size: 0.66rem;
          line-height: 1.1;
          padding: 0.22rem 0.38rem;
        }
        .timekeeper-racers-table small {
          font-size: 0.72rem;
          line-height: 1.1;
        }
      }`}</style>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="fw-bold mb-0">
            <Icon name="users" className="me-2" style={{ color: TK_ACCENT }} />
            Závodníci
          </h5>
          <small className="text-muted">Správa závodníků daného závodu bez zápisu do registrací</small>
        </div>
        {selectedRaceId && (
          <button
            className="btn btn-sm btn-outline-primary"
            style={{ borderRadius: '8px' }}
            onClick={() => navigate('/timekeeper/start-list')}
          >
            <Icon name="list-numbered" className="me-1" />Na startovní listinu
          </button>
        )}
      </div>

      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '10px' }}>
        <div className="card-body py-2 px-3">
          <div className="row align-items-center g-2">
            <div className="col-md-6">
              <SelectedRaceBar race={selectedRace} />
            </div>
            <div className="col-md-6 text-md-end">
              <small className="text-muted">
                {selectedRace ? `${selectedRace.race_nr || `#${selectedRace.id}`} • ${selectedRace.areal_name || 'Neznámé místo'}` : 'Na této záložce nelze závod přepínat'}
              </small>
            </div>
          </div>
        </div>
      </div>

      <TimekeeperMessage message={message} onDismiss={() => setMessage(null)} />

      {selectedRaceId && (
        <div className="card border-0 shadow-sm mb-3 timekeeper-racers-panel" style={{ borderRadius: '10px' }}>
          <div className="card-header bg-white py-2 px-3 border-bottom" style={{ borderRadius: '10px 10px 0 0' }}>
            <h6 className="fw-bold mb-0">
              <Icon name="user-plus" className="me-2" style={{ color: TK_ACCENT }} />
              Přidat závodníka do závodu
            </h6>
          </div>
          <div className="card-body py-3 px-3">
            <div className="row g-3">
              <div className="col-12 col-xl-8">
                <form onSubmit={handleSubmit}>
                  <RegistrationFormFields
                    formData={formData}
                    updateField={updateField}
                    clubs={clubs}
                    showContactFields={false}
                  />

                  <div className="row g-2 mt-0">
                    <div className="col-md-4">
                      <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                        <Icon name="numbers" />
                        Systémové číslo
                      </label>
                      <input
                        type="number"
                        className={`form-control form-control-sm registration-input ${liveRaceNumberError ? 'is-invalid' : ''}`}
                        placeholder="Automatický návrh"
                        value={formData.race_number_display}
                        onChange={(e) => updateField('race_number_display', e.target.value)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.15)',
                          color: 'var(--text-primary)',
                          border: liveRaceNumberError
                            ? '1px solid #dc3545'
                            : '1px solid rgba(255, 107, 0, 0.4)',
                        }}
                      />
                      {liveRaceNumberError && (
                        <div className="invalid-feedback d-block">{liveRaceNumberError}</div>
                      )}
                      {!liveRaceNumberError && (
                        <div className="form-text mt-1" style={{ color: '#6c757d', fontSize: '0.75rem' }}>
                          Návrh dalšího volného čísla: <strong>{getNextAvailableRaceNumberDisplay() || '—'}</strong>
                        </div>
                      )}
                    </div>
                    <div className="col-md-8">
                      <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                        <Icon name="user" />
                        Číslo dresu
                      </label>
                      <div className="d-flex align-items-center justify-content-between gap-3 px-3 py-2 rounded-3" style={{
                        background: selectedRaceNumberTheme.soft,
                        border: `1px solid ${selectedRaceNumberTheme.border}`,
                        color: '#1a1a2e',
                        minHeight: '44px',
                      }}>
                        <div className="d-flex align-items-center gap-2">
                          <span className="text-muted small fw-semibold">Přiřazeno:</span>
                          <span className="badge" style={{ ...getRaceNumberBadgeStyle(selectedRaceNumberOption?.set_color), fontSize: '1rem', padding: '0.45rem 0.95rem' }}>
                            {selectedRaceNumberOption?.actual_number ?? '—'}
                          </span>
                        </div>
                        <small className="fw-semibold" style={{ color: selectedRaceNumberTheme.solid }}>
                          {selectedRaceNumberOption ? `Sada ${selectedRaceNumberOption.set_number}` : 'Bez sady'}
                        </small>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 d-flex flex-wrap align-items-center gap-2 small">
                    <span
                      className="badge border"
                      style={{
                        background: '#ffe7b3',
                        borderColor: '#f59e0b',
                        color: '#6b3f00',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        padding: '0.45rem 0.7rem',
                      }}
                    >
                      Kategorie: {categoryPreview(formData.year, formData.sex)}
                    </span>
                  </div>

                  <div className="d-flex gap-2 justify-content-end mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => resetForm()}
                    >
                      <Icon name="x-circle" className="me-1" />
                      Vymazat
                    </button>
                    <button
                      type="submit"
                      className="btn btn-sm"
                      disabled={submitting}
                      style={{
                        background: TK_ACCENT_GRADIENT,
                        color: 'white',
                        border: 'none',
                        fontWeight: '500',
                      }}
                    >
                      {submitting ? (
                        <><ButtonSpinner />Přidávám...</>
                      ) : (
                        <><Icon name="plus-circle" className="me-1" />Přidat</>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              <div className="col-12 col-xl-4">
                <div className="border rounded-3 p-2 h-100" style={{ background: '#fafbfc', minHeight: '100%' }}>
                  <RacerSearchResults
                    filteredRacers={searchResults}
                    isSearching={isSearching}
                    selectExistingRacer={selectExistingRacer}
                    getSexLabel={getSexLabel}
                  />
                </div>
                {selectedRacer && (
                  <div className="alert alert-info mt-2 py-2 small mb-0">
                    Vybrán: <strong>{selectedRacer.name} {selectedRacer.surname}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && selectedRaceId && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: '10px' }}>
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <div>
                <h6 className="fw-bold mb-0">Seznam závodníků závodu</h6>
                <small className="text-muted">Řazení odpovídá startovní listině</small>
              </div>
              <span className="badge bg-dark">{filteredEntries.length} / {startList.length}</span>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-md-3">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Filtrovat textem..."
                  value={filters.text}
                  onChange={(e) => setFilters(prev => ({ ...prev, text: e.target.value }))}
                />
              </div>
              <div className="col-md-3">
                <select
                  className="form-select form-select-sm"
                  value={filters.club}
                  onChange={(e) => setFilters(prev => ({ ...prev, club: e.target.value }))}
                >
                  <option value="all">Všechny oddíly</option>
                  {clubOptions.map(club => (
                    <option key={club} value={club}>{club}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <select
                  className="form-select form-select-sm"
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                >
                  <option value="all">Všechny kategorie</option>
                  {categoryOptions.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <select
                  className="form-select form-select-sm"
                  value={filters.sex}
                  onChange={(e) => setFilters(prev => ({ ...prev, sex: e.target.value }))}
                >
                  <option value="all">Všechna pohlaví</option>
                  <option value="1">Muži</option>
                  <option value="2">Ženy</option>
                </select>
              </div>
            </div>

            {loading ? (
              <LoadingState variant="timekeeper" />
            ) : filteredEntries.length === 0 ? (
              <EmptyState icon="filter" title="Žádní závodníci neodpovídají aktuálním filtrům." />
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0 timekeeper-racers-table">
                  <thead className="table-light">
                    <tr>
                      <th>Pořadí</th>
                      <th>St. číslo</th>
                      <th>Závodník</th>
                      <th>Roč.</th>
                      <th>Pohlaví</th>
                      <th>Kategorie</th>
                      <th>Oddíl</th>
                      <th style={{ width: '85px' }}>Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map(entry => (
                      editingId === entry.id ? (
                        <tr key={entry.id} style={{ background: '#fffbea' }}>
                          <td className="fw-bold">{entry.start_number || '—'}</td>
                          <td>
                            <input type="number" className={`form-control form-control-sm ${(liveEditRaceNumberError || editValidationError) ? 'is-invalid' : ''}`}
                              style={{ width: '78px', fontSize: '0.8rem', padding: '2px 4px' }}
                              value={editForm.race_number_display}
                              onChange={(e) => { setEditForm(p => ({ ...p, race_number_display: e.target.value })); setEditValidationError(''); }}
                            />
                            {(liveEditRaceNumberError || editValidationError) && (
                              <div className="invalid-feedback d-block" style={{ fontSize: '0.7rem' }}>{liveEditRaceNumberError || editValidationError}</div>
                            )}
                          </td>
                          <td>
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
                          <td>
                            <input type="number" className="form-control form-control-sm"
                              style={{ width: '60px', fontSize: '0.8rem', padding: '2px 4px' }}
                              value={editForm.racer_year}
                              onChange={(e) => setEditForm(p => ({ ...p, racer_year: e.target.value }))}
                            />
                          </td>
                          <td>
                            <select className="form-select form-select-sm"
                              style={{ width: '75px', fontSize: '0.8rem', padding: '2px 4px' }}
                              value={editForm.racer_sex}
                              onChange={(e) => setEditForm(p => ({ ...p, racer_sex: e.target.value }))}
                            >
                              <option value="">—</option>
                              <option value="1">Muž</option>
                              <option value="2">Žena</option>
                            </select>
                          </td>
                          <td>
                            <small className="text-muted">{categoryPreview(editForm.racer_year, editForm.racer_sex)}</small>
                          </td>
                          <td>
                            <input type="text" className="form-control form-control-sm"
                              style={{ fontSize: '0.8rem', padding: '2px 4px' }}
                              value={editForm.club_name}
                              onChange={(e) => setEditForm(p => ({ ...p, club_name: e.target.value }))}
                              placeholder="Klub"
                              list="clubs"
                            />
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              <button className="btn btn-sm btn-success py-0 px-1" style={{ fontSize: '0.75rem' }}
                                onClick={saveEditing} aria-label="Uložit" title="Uložit">
                                <Icon name="check" />
                              </button>
                              <button className="btn btn-sm btn-outline-secondary py-0 px-1" style={{ fontSize: '0.75rem' }}
                                onClick={cancelEditing} aria-label="Zrušit" title="Zrušit">
                                <Icon name="close" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <TimekeeperRacerRow key={entry.id} entry={entry} onEdit={startEditing} />
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {!selectedRaceId && (
        <EmptyState icon="pointer" title="Vyberte závod" />
      )}
    </div>
  );
}
