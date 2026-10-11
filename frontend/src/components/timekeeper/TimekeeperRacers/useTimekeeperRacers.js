import { useCallback, useEffect, useMemo, useState } from 'react';
import { TimekeeperAPI } from '../../../config/timekeeperApi.js';
import { storeSelectedRaceId } from '../frame/selectedRace.js';
import {
  OFFLINE_QUEUED_TEXT,
  findRaceNumberOption,
  getRaceNumberValidationError,
  resolveCategoryPreview,
  sortStartListEntries,
} from '../startListHelpers.js';
import { EMPTY_FILTERS, categoryOptionsOf, clubOptionsOf, filterEntries, racerSearchQuery } from './racers.js';

/**
 * Závodníci jednoho závodu – přidání a inline oprava bez zápisu do registrací.
 *
 * Pravidla startovních čísel, řazení listiny i náhled kategorie jsou ve
 * `startListHelpers.js` – platí i na obrazovce Startovní listina a rozejít se
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

export const useTimekeeperRacers = (selectedRaceId) => {
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
  const [filters, setFilters] = useState(EMPTY_FILTERS);

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
    const query = racerSearchQuery(formData);

    if (!query) {
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
      setFilters(EMPTY_FILTERS);
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

  const updateEditField = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
    if (field === 'race_number_display') setEditValidationError('');
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

  const addRacer = async () => {
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

  const clubOptions = useMemo(() => clubOptionsOf(startList), [startList]);
  const categoryOptions = useMemo(() => categoryOptionsOf(startList), [startList]);
  const filteredEntries = useMemo(() => filterEntries(startList, filters), [startList, filters]);

  const liveRaceNumberError = useMemo(
    () => validateRaceNumber(formData.race_number_display),
    [validateRaceNumber, formData.race_number_display]
  );
  const selectedRaceNumberOption = useMemo(
    () => findRaceNumberOption(raceNumberOptions, formData.race_number_display),
    [raceNumberOptions, formData.race_number_display]
  );
  const liveEditRaceNumberError = useMemo(
    () => (editingId ? validateRaceNumber(editForm.race_number_display, editingId) : ''),
    [validateRaceNumber, editingId, editForm.race_number_display]
  );

  return {
    startList,
    loading,
    clubs,
    message,
    clearMessage: () => setMessage(null),
    // přidání
    formData,
    updateField,
    resetForm,
    addRacer,
    submitting,
    searchResults,
    isSearching,
    selectedRacer,
    selectExistingRacer,
    liveRaceNumberError,
    nextRaceNumber: getNextAvailableRaceNumberDisplay(),
    selectedRaceNumberOption,
    categoryPreview,
    // filtry
    filters,
    setFilter: (field, value) => setFilters(prev => ({ ...prev, [field]: value })),
    resetFilters: () => setFilters(EMPTY_FILTERS),
    clubOptions,
    categoryOptions,
    filteredEntries,
    // oprava řádku
    editingId,
    editForm,
    updateEditField,
    startEditing,
    cancelEditing,
    saveEditing,
    editError: liveEditRaceNumberError || editValidationError,
  };
};
