import { useConfirm } from '../../../hooks/useConfirm.jsx';
import { Alert, Button, EmptyState, LoadingState, Tooltip } from '../../ms/index.js';
import AdminPage from '../frame/AdminPage/AdminPage.jsx';
import { categoriesMeta } from './categories.js';
import CategoryDialog from './CategoryDialog/CategoryDialog.jsx';
import CategoryTable from './CategoryTable/CategoryTable.jsx';
import CoverageReport from './CoverageReport/CoverageReport.jsx';
import RecalculateSummary from './RecalculateSummary/RecalculateSummary.jsx';
import { useCategoryManagement } from './useCategoryManagement.js';

/**
 * Kategorie (AdminKategorie, AdminDialogUpravitKategorii,
 * AdminDialogSmazatKategorii, AdminDialogPokrytiKategorii,
 * AdminDialogPrepocetKategorii): tabulka kategorií, formulář v dialogu,
 * zrcadlení, kontrola pokrytí ročníků a hromadný přepočet. Data drží
 * useCategoryManagement.
 */
export default function CategoryManagement() {
  // Hook sám nic nerenderuje, dialog proto vlastní tahle komponenta.
  const { confirm, confirmElement } = useConfirm();
  const cm = useCategoryManagement({ confirm });

  if (!cm.authLoading && !cm.isAuthenticated) {
    return (
      <AdminPage title="Kategorie">
        <Alert type="warning" compact title="Pro přístup k této stránce se musíte přihlásit." />
      </AdminPage>
    );
  }
  if (cm.authLoading || cm.loading) {
    return (
      <AdminPage title="Kategorie">
        <LoadingState label="Načítám kategorie…" />
      </AdminPage>
    );
  }

  const actions = (
    <>
      <Tooltip text="Ročníky od 1900 do dneška">
        <Button
          size="sm"
          icon="coverage"
          busy={cm.checkingCoverage}
          onClick={cm.handleCheckCoverage}
        >
          {cm.checkingCoverage ? 'Kontroluji…' : 'Kontrola pokrytí'}
        </Button>
      </Tooltip>
      <Tooltip text="Všem závodníkům podle ročníku a pohlaví">
        <Button size="sm" icon="repeat" busy={cm.recalculating} onClick={cm.handleRecalculate}>
          {cm.recalculating ? 'Přepočítávám…' : 'Přepočítat kategorie'}
        </Button>
      </Tooltip>
      <Button variant="primary" size="sm" icon="plus" onClick={cm.openCreate}>
        Nová kategorie
      </Button>
    </>
  );

  return (
    <AdminPage title="Kategorie" meta={categoriesMeta(cm.categories)} actions={actions}>
      {cm.recalculateResult && (
        <RecalculateSummary result={cm.recalculateResult} onDismiss={cm.dismissRecalculate} />
      )}
      {cm.error && !cm.showForm && (
        <Alert type="danger" compact title={cm.error} onDismiss={() => cm.setError(null)} />
      )}
      {cm.success && !cm.recalculateResult && (
        <Alert
          key={cm.success}
          type="success"
          compact
          title={cm.success}
          onDismiss={() => cm.setSuccess('')}
        />
      )}
      {cm.showCoverageReport && cm.coverageReport && (
        <CoverageReport
          report={cm.coverageReport}
          showDetails={cm.showCoverageDetails}
          onToggleDetails={cm.toggleCoverageDetails}
          onClose={cm.closeCoverageReport}
        />
      )}
      {cm.sortedCategories.length === 0 ? (
        <EmptyState icon="tag" title="Zatím nebyly vytvořeny žádné kategorie" />
      ) : (
        <CategoryTable
          categories={cm.sortedCategories}
          onEdit={cm.handleEdit}
          onCreateMirror={cm.handleCreateMirror}
          onToggleActive={cm.handleToggleActive}
          onDelete={cm.handleDelete}
        />
      )}
      {cm.showForm && (
        <CategoryDialog
          editingCategory={cm.editingCategory}
          formData={cm.formData}
          setField={cm.setField}
          error={cm.error}
          onDismissError={() => cm.setError(null)}
          onSubmit={cm.handleSubmit}
          onClose={cm.resetForm}
        />
      )}
      {confirmElement}
    </AdminPage>
  );
}
