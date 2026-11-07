import { useEffect, useMemo, useState } from 'react';
import { AdminAPI } from '../../../config/api.js';
import { useAuth } from '../../../config/auth.jsx';
import { categoryForm, emptyCategoryForm, mirrorSex, sortCategories } from './categories.js';
import {
  deleteCategoryConfirm,
  mirrorCategoryConfirm,
  recalculateConfirm,
} from './dialogs/categoryConfirms.js';

/**
 * Data a akce správy kategorií: seznam, formulář, zrcadlení, přepnutí
 * aktivity, kontrola pokrytí ročníků a hromadný přepočet.
 * @param {{confirm: Function}} options - confirm z useConfirm komponenty
 */
export function useCategoryManagement({ confirm }) {
  const { loading: authLoading, isAuthenticated } = useAuth();
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
  const [formData, setFormData] = useState(() => emptyCategoryForm());

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

  useEffect(() => {
    // Počkáme, až doběhne ověření přihlášení - bez tokenu by dotaz spadl na 401.
    if (!authLoading && isAuthenticated) loadCategories({ showSpinner: true });
  }, [authLoading, isAuthenticated]);

  // Řadí se memoizovaná kopie – řazení pole ze stavu na místě by stav zmutovalo.
  const sortedCategories = useMemo(() => sortCategories(categories), [categories]);

  const resetForm = () => {
    setFormData(emptyCategoryForm());
    setEditingCategory(null);
    setShowForm(false);
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData(categoryForm(category));
    setShowForm(true);
    setError(null);
    setSuccess('');
  };

  const setField = (name, value) => setFormData((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (parseInt(formData.min_birth_year, 10) > parseInt(formData.max_birth_year, 10)) {
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

  const handleDelete = async (category) => {
    if (!(await confirm(deleteCategoryConfirm(category)))) return;
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
    const newSex = mirrorSex(category.sex);
    if (newSex === null) {
      setError('Mix kategorie nelze zrcadlit - už funguje pro všechna pohlaví');
      return;
    }
    const sexName = newSex === 1 ? 'mužskou' : 'ženskou';
    if (!(await confirm(mirrorCategoryConfirm(category, sexName)))) return;
    try {
      await AdminAPI.post('/api/admin/categories', {
        name: category.name,
        display_name: '',
        min_birth_year: category.min_birth_year,
        max_birth_year: category.max_birth_year,
        sex: newSex,
        active: category.active,
      });
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
      setCategories((prev) =>
        prev.map((cat) => (cat.id === id ? { ...cat, active: !currentActive } : cat)),
      );
    } catch (err) {
      console.error('Error toggling category active status:', err);
      setError(err.message || 'Nepodařilo se změnit status kategorie');
    }
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
    if (!(await confirm(recalculateConfirm()))) return;
    try {
      setRecalculating(true);
      setRecalculateResult(null);
      const data = await AdminAPI.post('/api/admin/categories/recalculate/all', {});
      setRecalculateResult({
        message: data.message,
        stats: data.stats,
        updates: data.updates || [],
        summary: {
          total_racers: data.stats.total,
          updated_racers: data.stats.updated,
          unchanged_racers: data.stats.unchanged,
          no_category_racers: data.stats.no_category,
        },
      });
      setError(null);
      // Pokud jsou nějaké problémy, zobraz je jako varování
      if (data.stats.no_category > 0) {
        setError(
          `Varování: ${data.stats.no_category} závodníků nemá vhodnou kategorii podle roku narození a pohlaví. Zkontrolujte pokrytí kategorií.`,
        );
      }
    } catch (err) {
      console.error('Error recalculating:', err);
      setError(err.message || 'Nepodařilo se přepočítat kategorie závodníků');
      setRecalculateResult(null);
    } finally {
      setRecalculating(false);
    }
  };

  return {
    authLoading,
    isAuthenticated,
    loading,
    categories,
    sortedCategories,
    error,
    setError,
    success,
    setSuccess,
    showForm,
    editingCategory,
    formData,
    setField,
    openCreate,
    resetForm,
    handleEdit,
    handleSubmit,
    handleDelete,
    handleCreateMirror,
    handleToggleActive,
    coverageReport,
    showCoverageReport,
    closeCoverageReport: () => setShowCoverageReport(false),
    showCoverageDetails,
    toggleCoverageDetails: () => setShowCoverageDetails((prev) => !prev),
    checkingCoverage,
    handleCheckCoverage,
    recalculating,
    recalculateResult,
    dismissRecalculate: () => setRecalculateResult(null),
    handleRecalculate,
  };
}
