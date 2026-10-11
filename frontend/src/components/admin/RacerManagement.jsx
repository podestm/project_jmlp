import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AdminAPI } from '../../config/api.js';
import Alert from '../ui/Alert.jsx';
import LoadingState from '../ui/LoadingState.jsx';
import SearchableSelect from '../ui/SearchableSelect.jsx';
import { useConfirm } from '../../hooks/useConfirm.jsx';
import Icon from '../ms/Icon/Icon.jsx';

// Závodníků jsou v databázi tisíce. Vykreslit je všechny naráz znamená tisíce
// řádků v DOMu a zaseknutou stránku, proto se ukazuje po stovkách.
const PAGE_SIZE = 100;

// Hledání filtruje celé pole v paměti; bez odkladu by se to přepočítávalo
// (a tabulka překreslovala) po každé stisknuté klávese.
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Jeden řádek tabulky.
 *
 * Memoizovaný schválně: při psaní do hledání se překresluje celá obrazovka,
 * ale data samotných řádků se nemění - bez memo by React zbytečně přepočítal
 * všech sto. Předpokladem je, že `onEdit` i `onDelete` jsou stabilní
 * (useCallback v rodiči), jinak memo nic neušetří.
 */
const RacerRow = React.memo(function RacerRow({ racer, onEdit, onDelete }) {
  return (
    <tr>
      <td>{racer.firstName}</td>
      <td>{racer.lastName}</td>
      <td>
        <span className={`badge ${racer.sex === 1 ? 'bg-primary' : 'bg-success'}`}>
          {racer.sex === 1 ? 'M' : 'Z'}
        </span>
      </td>
      <td>{racer.birthYear}</td>
      <td>
        {racer.category_name ? (
          <span className="badge bg-info">{racer.category_name}</span>
        ) : '-'}
      </td>
      <td>{racer.club_name || 'Bez oddílu'}</td>
      <td><code>{racer.idSlcr || 'N/A'}</code></td>
      <td>
        <div className="btn-group">
          <button
            onClick={() => onEdit(racer)}
            className="btn btn-sm btn-outline-primary"
            aria-label="Upravit" title="Upravit"
          >
            <Icon name="pencil" />
          </button>
          <button
            onClick={() => onDelete(racer)}
            className="btn btn-sm btn-outline-danger"
            aria-label="Smazat" title="Smazat"
          >
            <Icon name="trash" />
          </button>
        </div>
      </td>
    </tr>
  );
});

export default function RacerManagement() {
  const { confirm, confirmElement } = useConfirm();
  const [racers, setRacers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRacer, setEditingRacer] = useState(null);

  // Filtry
  const [filterClub, setFilterClub] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSex, setFilterSex] = useState('');
  const [searchInput, setSearchInput] = useState('');   // co je v poli
  const [searchText, setSearchText] = useState('');     // podle čeho se filtruje

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    sex: 1, // 1=muž, 2=žena
    birthYear: new Date().getFullYear() - 20,
    club_id: '',
    idSlcr: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearchText(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Po změně filtru se začíná zase od první stovky - jinak by uživatel po
  // zúžení výběru koukal na "zobrazeno 300 z 12".
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchText, filterClub, filterCategory, filterSex]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [racersData, clubsData, categoriesData] = await Promise.all([
        AdminAPI.get('/api/admin/racers'),
        AdminAPI.get('/races/organizers'),
        AdminAPI.get('/api/admin/categories')
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

  // Filtrovaní závodníci
  const filteredRacers = useMemo(() => {
    return racers.filter(racer => {
      // Filtr podle klubu
      if (filterClub && racer.club_id !== parseInt(filterClub)) {
        return false;
      }
      // Filtr podle kategorie
      if (filterCategory && racer.category_id !== parseInt(filterCategory)) {
        return false;
      }
      // Filtr podle pohlaví
      if (filterSex && racer.sex !== parseInt(filterSex)) {
        return false;
      }
      // Textové vyhledávání (jméno, příjmení, SLCR ID)
      if (searchText) {
        const search = searchText.toLowerCase();
        const matchesName = (racer.firstName || '').toLowerCase().includes(search);
        const matchesSurname = (racer.lastName || '').toLowerCase().includes(search);
        const matchesSlcr = (racer.idSlcr || '').toLowerCase().includes(search);
        if (!matchesName && !matchesSurname && !matchesSlcr) {
          return false;
        }
      }
      return true;
    });
  }, [racers, filterClub, filterCategory, filterSex, searchText]);

  const visibleRacers = useMemo(
    () => filteredRacers.slice(0, visibleCount),
    [filteredRacers, visibleCount]
  );

  const clubOptions = useMemo(
    () => clubs.map(club => ({ value: String(club.id), label: club.name })),
    [clubs]
  );

  // Stejné pravidlo jako category_display_sql na serveru: bez toho ukazuje
  // filtr interní název, zatímco sloupec v tabulce zobrazovaný, a zrcadlové
  // kategorie splynou ve dvě nerozlišitelné položky.
  const categoryOptions = useMemo(
    () => categories.map(cat => ({
      value: String(cat.id),
      label: cat.display_name
        || `${cat.name}${cat.sex === 1 ? ' - Muži' : cat.sex === 2 ? ' - Ženy' : ''}`,
    })),
    [categories]
  );

  // Reset filtrů
  const resetFilters = () => {
    setFilterClub('');
    setFilterCategory('');
    setFilterSex('');
    setSearchInput('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Nevybraný oddíl je ve formuláři prázdný řetězec, ale schéma na serveru
      // čeká číslo nebo nic - prázdný řetězec by skončil chybou 422.
      const payload = {
        ...formData,
        club_id: formData.club_id ? parseInt(formData.club_id, 10) : null,
      };

      if (editingRacer) {
        await AdminAPI.put(`/api/admin/racers/${editingRacer.id}`, payload);
      } else {
        await AdminAPI.post('/api/admin/racers', payload);
      }

      // Reset form and reload data
      setFormData({
        firstName: '',
        lastName: '',
        sex: 1,
        birthYear: new Date().getFullYear() - 20,
        club_id: '',
        idSlcr: ''
      });
      setEditingRacer(null);
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error('Error saving racer:', err);
      setError(err.message || 'Nepodařilo se uložit závodníka');
    }
  };

  // useCallback, aby memoizované řádky nedostávaly novou funkci při každém renderu
  const handleEdit = useCallback((racer) => {
    setEditingRacer(racer);
    setFormData({
      firstName: racer.firstName || '',
      lastName: racer.lastName || '',
      sex: racer.sex || 1,
      birthYear: racer.birthYear || new Date().getFullYear() - 20,
      club_id: racer.club_id || '',
      idSlcr: racer.idSlcr || ''
    });
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (racer) => {
    const label = `${racer.firstName || ''} ${racer.lastName || ''}`.trim() || `#${racer.id}`;
    const confirmed = await confirm({
      title: 'Smazat závodníka?',
      message: `Opravdu chcete smazat závodníka ${label} (ročník ${racer.birthYear || '?'})? Tuto akci nelze vrátit zpět.`,
      confirmLabel: 'Smazat',
      variant: 'danger',
      icon: 'trash'
    });
    if (!confirmed) return;

    try {
      await AdminAPI.delete(`/api/admin/racers/${racer.id}`);
      loadData();
    } catch (err) {
      console.error('Error deleting racer:', err);
      setError(err.message || 'Nepodařilo se smazat závodníka');
    }
  }, [confirm, loadData]);

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      sex: 1,
      birthYear: new Date().getFullYear() - 20,
      club_id: '',
      idSlcr: ''
    });
    setEditingRacer(null);
    setShowForm(false);
  };

  if (loading) {
    return <LoadingState />;
  }

  const filtersActive = Boolean(filterClub || filterCategory || filterSex || searchInput);

  return (
    <div className="container-fluid admin-section">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>Správa závodníků</h2>
            <div className="d-flex gap-2">
              {/* Podagenda Závodníků - v bočním menu záměrně není. */}
              <Link to="/admin/racers/slcr" className="btn btn-outline-primary">
                <Icon name="user-check" className="me-2" />
                Párování SLČR
              </Link>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="btn btn-primary"
              >
                <Icon name="plus-circle" className="me-2" />
                Nový závodník
              </button>
            </div>
          </div>

          {error && (
            <Alert
              type="danger"
              message={error}
              onDismiss={() => setError(null)}
            />
          )}

          {/* Filtry */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label small text-muted">
                    <Icon name="search" className="me-1" />
                    Hledat
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Jméno, příjmení, SLCR..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label small text-muted">
                    <Icon name="building" className="me-1" />
                    Klub
                  </label>
                  <SearchableSelect
                    options={clubOptions}
                    value={filterClub}
                    onChange={setFilterClub}
                    placeholder="Všechny kluby"
                    allLabel="Všechny kluby"
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label small text-muted">
                    <Icon name="tag" className="me-1" />
                    Kategorie
                  </label>
                  <SearchableSelect
                    options={categoryOptions}
                    value={filterCategory}
                    onChange={setFilterCategory}
                    placeholder="Všechny kategorie"
                    allLabel="Všechny kategorie"
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label small text-muted">
                    <Icon name="gender" className="me-1" />
                    Pohlaví
                  </label>
                  <select
                    className="form-select"
                    value={filterSex}
                    onChange={(e) => setFilterSex(e.target.value)}
                  >
                    <option value="">Všichni</option>
                    <option value="1">Muži</option>
                    <option value="2">Ženy</option>
                  </select>
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  {filtersActive && (
                    <button
                      className="btn btn-outline-secondary w-100"
                      onClick={resetFilters}
                    >
                      <Icon name="x-circle" className="me-1" />
                      Zrušit
                    </button>
                  )}
                </div>
              </div>
              {filtersActive && (
                <div className="mt-2 text-muted small">
                  <Icon name="filter" className="me-1" />
                  Zobrazeno {filteredRacers.length} z {racers.length} závodníků
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Jméno</th>
                      <th>Příjmení</th>
                      <th>Pohlaví</th>
                      <th>Ročník</th>
                      <th>Kategorie</th>
                      <th>Oddíl</th>
                      <th>ID SLCR</th>
                      <th>Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRacers.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center text-muted">
                          {racers.length === 0 ? 'Žádní závodníci nenalezeni' : 'Žádní závodníci neodpovídají filtru'}
                        </td>
                      </tr>
                    ) : (
                      visibleRacers.map((racer) => (
                        <RacerRow
                          key={racer.id}
                          racer={racer}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {filteredRacers.length > visibleRacers.length && (
                <div className="text-center mt-3">
                  <div className="text-muted small mb-2">
                    Zobrazeno {visibleRacers.length} z {filteredRacers.length} závodníků — upřesněte hledání
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => setVisibleCount(count => count + PAGE_SIZE)}
                  >
                    <Icon name="chevron-down" className="me-1" />
                    Zobrazit dalších {Math.min(PAGE_SIZE, filteredRacers.length - visibleRacers.length)}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal formulář pro přidání/editaci závodníka */}
      {showForm && (
        <div className="modal show" style={{ display: 'block' }} tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingRacer ? 'Upravit závodníka' : 'Nový závodník'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowForm(false)}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Jméno *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.firstName}
                          onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                          required
                          placeholder="Jan"
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Příjmení *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.lastName}
                          onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                          required
                          placeholder="Novák"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label className="form-label">Pohlaví</label>
                        <select
                          className="form-control"
                          value={formData.sex}
                          onChange={(e) => setFormData({...formData, sex: parseInt(e.target.value)})}
                        >
                          <option value={1}>Muž</option>
                          <option value={2}>Žena</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label className="form-label">Ročník narození</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.birthYear}
                          onChange={(e) => setFormData({...formData, birthYear: parseInt(e.target.value)})}
                          min="1940"
                          max={new Date().getFullYear()}
                          placeholder="1990"
                        />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label className="form-label">ID SLCR</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.idSlcr}
                          onChange={(e) => setFormData({...formData, idSlcr: e.target.value})}
                          maxLength="10"
                          placeholder="ABC1234567"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-12">
                      <div className="mb-3">
                        <label className="form-label">Oddíl</label>
                        <select
                          className="form-control"
                          value={formData.club_id}
                          onChange={(e) => setFormData({...formData, club_id: e.target.value})}
                        >
                          <option value="">Vyberte oddíl</option>
                          {clubs.map(club => (
                            <option key={club.id} value={club.id}>{club.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowForm(false)}
                  >
                    Zrušit
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingRacer ? 'Uložit změny' : 'Vytvořit závodníka'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showForm && <div className="modal-backdrop show"></div>}
      {confirmElement}
    </div>
  );
}
