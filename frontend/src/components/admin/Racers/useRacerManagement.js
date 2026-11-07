import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminAPI } from '../../../config/api.js';
import { deleteRacerConfirm } from './dialogs/deleteRacerConfirm.jsx';
import {
  EMPTY_FILTER, PAGE_SIZE, SEARCH_DEBOUNCE_MS, categoryOptions, clubOptions, emptyRacerForm,
  filterRacers, racerPayload, racerToForm,
} from './racers.js';

/**
 * Stav a akce obrazovky Závodníci: načtení závodníků s číselníky klubů
 * a kategorií, filtr s hledáním (odklad 250 ms), výpis po stovkách,
 * formulář nového závodníka / úpravy a mazání s potvrzením.
 *
 * `confirm` dodá useConfirm z komponenty – hook sám nic nerenderuje.
 */
export function useRacerManagement({ confirm }) {
  const [racers, setRacers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [searchInput, setSearchInput] = useState(''); // co je v poli
  const [searchText, setSearchText] = useState(''); // podle čeho se filtruje
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [showForm, setShowForm] = useState(false);
  const [editingRacer, setEditingRacer] = useState(null);
  const [formData, setFormData] = useState(emptyRacerForm);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [racersData, clubsData, categoriesData] = await Promise.all([
        AdminAPI.get('/api/admin/racers'),
        AdminAPI.get('/races/organizers'),
        AdminAPI.get('/api/admin/categories'),
      ]);
      setRacers(racersData);
      setClubs(clubsData);
      setCategories(categoriesData || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message || 'Nepodařilo se načíst závodníky');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchText(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Po změně filtru se začíná zase od první stovky – jinak by uživatel po
  // zúžení výběru koukal na „zobrazeno 300 z 12“.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchText, filter]);

  const filteredRacers = useMemo(() => filterRacers(racers, filter, searchText), [racers, filter, searchText]);
  const visibleRacers = useMemo(() => filteredRacers.slice(0, visibleCount), [filteredRacers, visibleCount]);
  const clubChoices = useMemo(() => clubOptions(clubs), [clubs]);
  const categoryChoices = useMemo(() => categoryOptions(categories), [categories]);

  const filtersActive = Boolean(filter.club || filter.category || filter.sex || searchInput);
  const setFilterValue = useCallback((key, value) => setFilter((prev) => ({ ...prev, [key]: value })), []);
  const resetFilters = () => {
    setFilter(EMPTY_FILTER);
    setSearchInput('');
  };
  const showMore = () => setVisibleCount((count) => count + PAGE_SIZE);

  const resetForm = () => {
    setFormData(emptyRacerForm());
    setEditingRacer(null);
    setShowForm(false);
  };

  const openNew = () => {
    resetForm();
    setShowForm(true);
  };

  // useCallback: řádky tabulky dostávají stále stejnou funkci.
  const openEdit = useCallback((racer) => {
    setEditingRacer(racer);
    setFormData(racerToForm(racer));
    setShowForm(true);
  }, []);

  // Zavření křížkem nebo Zrušit: rozepsaná data se zahodí až při dalším otevření.
  const closeForm = () => setShowForm(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload = racerPayload(formData);
      if (editingRacer) {
        await AdminAPI.put(`/api/admin/racers/${editingRacer.id}`, payload);
      } else {
        await AdminAPI.post('/api/admin/racers', payload);
      }
      resetForm();
      loadData();
    } catch (err) {
      console.error('Error saving racer:', err);
      setError(err.message || 'Nepodařilo se uložit závodníka');
    } finally {
      setSaving(false);
    }
  };

  const deleteRacer = useCallback(async (racer) => {
    if (!await confirm(deleteRacerConfirm(racer))) return;
    try {
      await AdminAPI.delete(`/api/admin/racers/${racer.id}`);
      loadData();
    } catch (err) {
      console.error('Error deleting racer:', err);
      setError(err.message || 'Nepodařilo se smazat závodníka');
    }
  }, [confirm, loadData]);

  return {
    racers,
    clubs,
    loading,
    error,
    setError,
    filter,
    setFilterValue,
    searchInput,
    setSearchInput,
    filtersActive,
    resetFilters,
    filteredRacers,
    visibleRacers,
    showMore,
    clubChoices,
    categoryChoices,
    showForm,
    editingRacer,
    formData,
    setFormData,
    saving,
    openNew,
    openEdit,
    closeForm,
    handleSubmit,
    deleteRacer,
  };
}

export default useRacerManagement;
