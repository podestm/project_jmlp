import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../config/auth.jsx';
import { AdminAPI } from '../../config/api.js';
import Alert from '../ui/Alert.jsx';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState.jsx';
import { useConfirm } from '../../hooks/useConfirm.jsx';
import CategoryForm from './category/CategoryForm.jsx';
import CategoryTable from './category/CategoryTable.jsx';
import CoverageReport from './category/CoverageReport.jsx';
import RecalculateSummary from './category/RecalculateSummary.jsx';

/** Prázdný formulář - stejný tvar pro první render i po uložení. */
const emptyForm = () => ({
  name: '',
  display_name: '',
  min_birth_year: new Date().getFullYear() - 50,
  max_birth_year: new Date().getFullYear() - 18,
  sex: 0, // 0 = mix, 1 = muži, 2 = ženy
  active: true
});

export default function CategoryManagement() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const { confirm, confirmElement } = useConfirm();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [coverageReport, setCoverageReport] = useState(null);
  const [showCoverageReport, setShowCoverageReport] = useState(false);
  const [showCoverageDetails, setShowCoverageDetails] = useState(false);
  const [checkingCoverage, setCheckingCoverage] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalculateResult, setRecalculateResult] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    // Počkáme, až doběhne ověření přihlášení - bez tokenu by dotaz spadl na 401.
    if (!authLoading && isAuthenticated) {
      loadCategories({ showSpinner: true });
    }
  }, [authLoading, isAuthenticated]);

  // Řadí se memoizovaná kopie: `categories.sort()` v renderu řadí pole ze stavu
  // na místě, což je mutace stavu - React pak nepozná, že se něco změnilo.
  const sortedCategories = useMemo(() => [...categories].sort((a, b) => (
    // Primárně od nejmladších ročníků, sekundárně Mix(0), Muži(1), Ženy(2).
    b.max_birth_year - a.max_birth_year || a.sex - b.sex
  )), [categories]);

  // Spinner jen při prvním načtení; refresh po uložení běží tiše, aby seznam
  // pod formulářem neproblikával.
  const loadCategories = async ({ showSpinner = false } = {}) => {
    try {
      if (showSpinner) setLoading(true);
      setRecalculateResult(null);
      const data = await AdminAPI.get('/api/admin/categories');
      setCategories(data);
      setError(null);
    } catch (err) {
      console.error('Error loading categories:', err);
      setError(err.message || 'Nepodařilo se načíst kategorie');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (parseInt(formData.min_birth_year) > parseInt(formData.max_birth_year)) {
      setError('Nejstarší ročník musí být menší nebo roven nejmladšímu ročníku');
      return;
    }

    try {
      if (editingCategory) {
        await AdminAPI.put(`/api/admin/categories/${editingCategory.id}`, formData);
        setSuccess('Kategorie úspěšně upravena');
      } else {
        await AdminAPI.post('/api/admin/categories', formData);
        setSuccess('Kategorie úspěšně vytvořena');
      }

      resetForm();
      loadCategories();
    } catch (err) {
      console.error('Error saving category:', err);
      setError(err.message || 'Nepodařilo se uložit kategorii');
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      display_name: category.display_name || '',
      min_birth_year: category.min_birth_year,
      max_birth_year: category.max_birth_year,
      sex: category.sex,
      active: category.active
    });
    setShowForm(true);
    setError(null);
    setSuccess('');
  };

  const handleDelete = async (category) => {
    // Kategorie se mažou z tabulky, kde je jich vedle sebe deset - do hlášky
    // proto patří název i rozsah ročníků, ať je jasné, co zmizí.
    const confirmed = await confirm({
      title: 'Smazat kategorii?',
      message: `Opravdu chcete smazat kategorii „${category.name}" (ročníky ${category.min_birth_year}–${category.max_birth_year})? Tuto akci nelze vrátit zpět.`,
      confirmLabel: 'Smazat',
      variant: 'danger',
      icon: 'bi-trash'
    });
    if (!confirmed) return;

    try {
      await AdminAPI.delete(`/api/admin/categories/${category.id}`);
      setSuccess('Kategorie úspěšně smazána');
      loadCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
      setError(err.message || 'Nepodařilo se smazat kategorii');
    }
  };

  const handleCreateMirror = async (category) => {
    // Určíme opačné pohlaví
    let newSex;
    if (category.sex === 0) {
      // Mix kategorie - necháme jako mix
      setError('Mix kategorie nelze zrcadlit - už funguje pro všechna pohlaví');
      return;
    } else if (category.sex === 1) {
      newSex = 2; // Muži -> Ženy
    } else {
      newSex = 1; // Ženy -> Muži
    }

    const sexName = newSex === 1 ? 'mužskou' : 'ženskou';

    const confirmed = await confirm({
      title: 'Vytvořit zrcadlovou kategorii?',
      message: `Vytvoří se ${sexName} kategorie „${category.name}" pro ročníky ${category.min_birth_year}–${category.max_birth_year}.`,
      confirmLabel: 'Vytvořit',
      variant: 'primary',
      icon: 'bi-arrows-angle-expand'
    });
    if (!confirmed) return;

    try {
      const mirrorData = {
        name: category.name,
        display_name: '',
        min_birth_year: category.min_birth_year,
        max_birth_year: category.max_birth_year,
        sex: newSex,
        active: category.active
      };

      await AdminAPI.post('/api/admin/categories', mirrorData);
      setSuccess(`Zrcadlová ${sexName} kategorie "${category.name}" byla úspěšně vytvořena`);
      loadCategories();
    } catch (err) {
      console.error('Error creating mirror category:', err);
      setError(err.message || 'Nepodařilo se vytvořit zrcadlovou kategorii');
    }
  };

  const handleToggleActive = async (id, currentActive) => {
    try {
      await AdminAPI.put(`/api/admin/categories/${id}`, { active: !currentActive });
      // Přepnutí je jednořádková změna - přepsat ji ve stavu je levnější
      // a bez probliknutí než znovu stahovat celý seznam.
      setCategories(prev => prev.map(cat => (
        cat.id === id ? { ...cat, active: !currentActive } : cat
      )));
    } catch (err) {
      console.error('Error toggling category active status:', err);
      setError(err.message || 'Nepodařilo se změnit status kategorie');
    }
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setEditingCategory(null);
    setShowForm(false);
    setError(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleCheckCoverage = async () => {
    try {
      setCheckingCoverage(true);
      setRecalculateResult(null);
      const data = await AdminAPI.get('/api/admin/categories/check/coverage');
      setCoverageReport(data);
      setShowCoverageReport(true);
      setError(null);
    } catch (err) {
      console.error('Error checking coverage:', err);
      setError(err.message || 'Nepodařilo se zkontrolovat pokrytí kategorií');
    } finally {
      setCheckingCoverage(false);
    }
  };

  const handleRecalculate = async () => {
    const confirmed = await confirm({
      title: 'Přepočítat kategorie závodníků?',
      message: 'Všem závodníkům se znovu přiřadí kategorie podle roku narození a pohlaví. Operace může trvat několik sekund.',
      confirmLabel: 'Přepočítat',
      variant: 'warning',
      icon: 'bi-arrow-repeat'
    });
    if (!confirmed) return;

    try {
      setRecalculating(true);
      setRecalculateResult(null);
      const data = await AdminAPI.post('/api/admin/categories/recalculate/all', {});

      // Uložíme celý výsledek pro pokročilé zobrazení
      setRecalculateResult({
        message: data.message,
        stats: data.stats,
        updates: data.updates || [], // Seznam aktualizovaných závodníků
        summary: {
          total_racers: data.stats.total,
          updated_racers: data.stats.updated,
          unchanged_racers: data.stats.unchanged,
          no_category_racers: data.stats.no_category
        }
      });

      setError(null);

      // Pokud jsou nějaké problémy, zobraz je jako varování
      if (data.stats.no_category > 0) {
        setError(`Varování: ${data.stats.no_category} závodníků nemá vhodnou kategorii podle roku narození a pohlaví. Zkontrolujte pokrytí kategorií.`);
      }
    } catch (err) {
      console.error('Error recalculating:', err);
      setError(err.message || 'Nepodařilo se přepočítat kategorie závodníků');
      setRecalculateResult(null);
    } finally {
      setRecalculating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="container-fluid">
        <LoadingState />
      </div>
    );
  }

  // Ak nie je autentifikovaný, presmeruj na login
  if (!isAuthenticated) {
    return (
      <div className="container-fluid">
        <div className="text-center py-5">
          <div className="alert alert-warning">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Pro přístup k této stránce se musíte přihlásit.
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container-fluid">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="container-fluid admin-section">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h1>
              <i className="bi bi-tag me-2"></i>
              Správa kategorií
            </h1>
            <div className="d-flex gap-2">
              <button
                className="btn btn-info"
                onClick={handleCheckCoverage}
                disabled={loading || checkingCoverage}
                title="Zkontroluje pokrytí kategorií od roku 1900 do současnosti"
              >
                {checkingCoverage ? (
                  <>
                    <ButtonSpinner />
                    Kontroluji...
                  </>
                ) : (
                  <>
                    <i className="bi bi-clipboard-check me-2"></i>
                    Kontrola pokrytí
                  </>
                )}
              </button>
              <button
                className="btn btn-warning"
                onClick={handleRecalculate}
                disabled={recalculating}
                title="Přepočítá kategorie pro všechny závodníky podle roku narození a pohlaví"
              >
                {recalculating ? (
                  <>
                    <ButtonSpinner />
                    Přepočítávám...
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-repeat me-2"></i>
                    Přepočítat kategorie
                  </>
                )}
              </button>
              <button
                className="btn btn-success"
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Nová kategorie
              </button>
            </div>
          </div>

          {recalculateResult && (
            <RecalculateSummary
              result={recalculateResult}
              onDismiss={() => setRecalculateResult(null)}
            />
          )}

          {error && (
            <Alert
              type="danger"
              message={
                <>
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error}
                </>
              }
              onDismiss={() => setError(null)}
            />
          )}

          {success && !recalculateResult && (
            <Alert
              type="success"
              message={
                <>
                  <i className="bi bi-check-circle me-2"></i>
                  {success}
                </>
              }
              onDismiss={() => setSuccess('')}
            />
          )}

          {showCoverageReport && coverageReport && (
            <CoverageReport
              report={coverageReport}
              showDetails={showCoverageDetails}
              onToggleDetails={() => setShowCoverageDetails(prev => !prev)}
              onClose={() => setShowCoverageReport(false)}
            />
          )}

          {showForm && (
            <CategoryForm
              formData={formData}
              editingCategory={editingCategory}
              onChange={handleChange}
              onSubmit={handleSubmit}
              onCancel={resetForm}
            />
          )}

          <CategoryTable
            categories={sortedCategories}
            onEdit={handleEdit}
            onCreateMirror={handleCreateMirror}
            onToggleActive={handleToggleActive}
            onDelete={handleDelete}
          />
        </div>
      </div>
      {confirmElement}
    </div>
  );
}
