import { useConfirm } from '../../../hooks/useConfirm.jsx';
import { useRaceManagement } from '../../../hooks/useRaceManagement.js';
import { Alert, Button, ButtonLink, EmptyState } from '../../ms/index.js';
import AdminPage from '../frame/AdminPage/AdminPage.jsx';
import RaceCard from './RaceCard/RaceCard.jsx';
import RaceFilters from './RaceFilters/RaceFilters.jsx';
import RaceForm from './RaceForm/RaceForm.jsx';
import RaceTable from './RaceTable/RaceTable.jsx';
import { listSummary, seasonMeta } from './raceList.js';
import styles from './RaceManagement.module.css';

/** Hlášky nad seznamem i formulářem (chyby zůstanou, úspěch sám zmizí). */
function Messages({ error, success, setError, setSuccess }) {
  return (
    <>
      {error && <Alert type="danger" compact title={error} onDismiss={() => setError(null)} />}
      {success && <Alert key={success} type="success" compact title={success} onDismiss={() => setSuccess(null)} />}
    </>
  );
}

/**
 * Závody (AdminZavody, AdminMobilZavody, AdminZavodForm): seznam s filtrem
 * sezóny, přepínáním registrací a exportem přihlášek; formulář závodu místo
 * seznamu. Data a akce drží useRaceManagement.
 */
export default function RaceManagement() {
  // Hook sám nic nerenderuje, dialog proto vlastní tahle komponenta
  // a `confirm` posílá dolů (viz komentář v useConfirm.jsx).
  const { confirm, confirmElement } = useConfirm();
  const rm = useRaceManagement({ confirm });
  const messages = <Messages error={rm.error} success={rm.success} setError={rm.setError} setSuccess={rm.setSuccess} />;

  const closeForm = () => {
    rm.setShowForm(false);
    rm.resetForm();
  };

  if (rm.showForm) {
    const race = rm.editingRace;
    const onDelete = async () => {
      if (await rm.deleteRace(race.id)) closeForm();
    };
    return (
      <AdminPage
        title={race ? 'Upravit závod' : 'Nový závod'}
        meta={race ? [race.race_nr, race.areal_name].filter(Boolean).join(' · ') : seasonMeta(rm.seasonFilter)}
        actions={(
          <>
            {race && <ButtonLink to={`/admin/races/${race.id}/registrations`} size="sm">Přihlášky závodu</ButtonLink>}
            <Button size="sm" icon="arrow-left" onClick={closeForm}>Zpět na seznam</Button>
          </>
        )}
      >
        {messages}
        <RaceForm
          editingRace={race}
          formData={rm.formData}
          setFormData={rm.setFormData}
          loading={rm.loading}
          arealSearch={rm.arealSearch}
          arealSuggestions={rm.arealSuggestions}
          organizerSearch={rm.organizerSearch}
          organizerSuggestions={rm.organizerSuggestions}
          raceNumberPreview={rm.raceNumberPreview}
          seasonPreview={rm.seasonPreview}
          handleArealSearch={rm.handleArealSearch}
          handleOrganizerSearch={rm.handleOrganizerSearch}
          selectAreal={rm.selectAreal}
          selectOrganizer={rm.selectOrganizer}
          generateRaceNumberLocal={rm.generateRaceNumberLocal}
          handleSubmit={rm.handleSubmit}
          onClose={closeForm}
          onDelete={onDelete}
        />
        {confirmElement}
      </AdminPage>
    );
  }

  const rowProps = {
    onEdit: rm.editRace,
    onToggleRegistration: rm.toggleRegistration,
    onDownloadCsv: rm.downloadRegistrationsCsv,
  };

  return (
    <AdminPage
      title="Závody"
      meta={seasonMeta(rm.seasonFilter)}
      actions={<Button variant="primary" size="sm" icon="plus" onClick={() => rm.setShowForm(true)} className={styles.add}>Nový závod</Button>}
    >
      <RaceFilters
        seasonFilter={rm.seasonFilter}
        setSeasonFilter={rm.setSeasonFilter}
        availableSeasons={rm.availableSeasons}
        summary={listSummary(rm.races)}
      />
      {messages}
      {rm.races.length === 0 ? (
        <EmptyState icon="calendar" title="Žádné závody nebyly nalezeny" />
      ) : (
        <>
          <RaceTable races={rm.races} {...rowProps} />
          <div className={styles.cards}>
            {rm.races.map((race) => <RaceCard key={race.id} race={race} {...rowProps} />)}
          </div>
        </>
      )}
      {confirmElement}
    </AdminPage>
  );
}
