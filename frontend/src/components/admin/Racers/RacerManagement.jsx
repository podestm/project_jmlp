import { useConfirm } from '../../../hooks/useConfirm.jsx';
import { Alert, Button, ButtonLink, EmptyState, LoadingState } from '../../ms/index.js';
import AdminPage from '../frame/AdminPage/AdminPage.jsx';
import RacerFilters from './RacerFilters/RacerFilters.jsx';
import RacerForm from './RacerForm/RacerForm.jsx';
import RacerList from './RacerList/RacerList.jsx';
import RacerTable from './RacerTable/RacerTable.jsx';
import ShowMore from './ShowMore/ShowMore.jsx';
import { useRacerManagement } from './useRacerManagement.js';
import styles from './RacerManagement.module.css';

/** Seznam, nebo prázdný stav – bez dat jinak než po filtru. */
function RacerResults({ rm }) {
  if (rm.visibleRacers.length === 0) {
    return rm.racers.length === 0 ? (
      <EmptyState icon="user" title="Žádní závodníci nenalezeni" hint="V databázi zatím není ani jeden závodník." />
    ) : (
      <EmptyState
        icon="search-x"
        title="Žádní závodníci neodpovídají filtru"
        hint="Zkuste jiné jméno, klub nebo kategorii."
        action={<Button size="sm" onClick={rm.resetFilters}>Zrušit filtry</Button>}
      />
    );
  }
  return (
    <>
      <RacerTable racers={rm.visibleRacers} onEdit={rm.openEdit} onDelete={rm.deleteRacer} />
      <RacerList racers={rm.visibleRacers} onEdit={rm.openEdit} onDelete={rm.deleteRacer} />
      <ShowMore shown={rm.visibleRacers.length} total={rm.filteredRacers.length} onMore={rm.showMore} />
    </>
  );
}

/**
 * Závodníci (AdminZavodnici, AdminDialogZavodnik, AdminDialogSmazatZavodnika):
 * databáze závodníků napříč ročníky s filtrem a výpisem po stovkách, formulář
 * v dialogu, mazání s potvrzením. Párování se SLČR je podstránka
 * /admin/racers/slcr (v bočním menu záměrně není). Data drží useRacerManagement.
 */
export default function RacerManagement() {
  // Hook sám nic nerenderuje, dialog proto vlastní tahle komponenta.
  const { confirm, confirmElement } = useConfirm();
  const rm = useRacerManagement({ confirm });

  const actions = (
    <>
      <ButtonLink to="/admin/racers/slcr" size="sm" icon="user-check" className={styles.action}>Párování SLČR</ButtonLink>
      <Button variant="primary" size="sm" icon="plus" onClick={rm.openNew} className={styles.action}>Nový závodník</Button>
    </>
  );

  return (
    <AdminPage
      title="Závodníci"
      meta="databáze napříč ročníky"
      description="Úprava, mazání a párování závodníků se SLČR."
      actions={actions}
    >
      {rm.loading ? (
        <LoadingState label="Načítám závodníky…" />
      ) : (
        <>
          {rm.error && !rm.showForm && (
            <Alert type="danger" compact title={rm.error} onDismiss={() => rm.setError(null)} />
          )}
          <RacerFilters
            searchInput={rm.searchInput}
            onSearchChange={rm.setSearchInput}
            filter={rm.filter}
            onFilterChange={rm.setFilterValue}
            clubs={rm.clubChoices}
            categories={rm.categoryChoices}
            shown={rm.filteredRacers.length}
            total={rm.racers.length}
            active={rm.filtersActive}
            onReset={rm.resetFilters}
          />
          <RacerResults rm={rm} />
        </>
      )}
      <RacerForm
        open={rm.showForm}
        editingRacer={rm.editingRacer}
        formData={rm.formData}
        setFormData={rm.setFormData}
        clubs={rm.clubs}
        racersCount={rm.racers.length}
        saving={rm.saving}
        error={rm.error}
        onDismissError={() => rm.setError(null)}
        onSubmit={rm.handleSubmit}
        onClose={rm.closeForm}
      />
      {confirmElement}
    </AdminPage>
  );
}
