import { useConfirm } from '../../../hooks/useConfirm.jsx';
import { OWNER, ROLE } from '../../../config/attachmentsApi.js';
import { useCurrentSeason } from '../../../hooks/useCurrentSeason.js';
import { Alert, Button, EmptyState, LoadingState, Paska } from '../../ms/index.js';
import AttachmentManager from '../Attachments/AttachmentManager.jsx';
import AdminPage from '../frame/AdminPage/AdminPage.jsx';
import SeasonCard from './SeasonCard/SeasonCard.jsx';
import SeasonDialog from './SeasonDialog/SeasonDialog.jsx';
import { currentSeasonOf, seasonsMeta, splitSeasons } from './seasons.js';
import { useSeasonManagement } from './useSeasonManagement.js';
import styles from './SeasonManagement.module.css';

// Sezóna má buď průběžné, nebo celkové výsledky - proto jeden slot s přepínačem
// typu, ne dva sloty. Během sezóny platí průběžné pořadí, po jejím konci ho
// nahradí celkové. Obecných dokumentů (soutěžní řád, pokyny) může být víc.
const SEASON_ROLES = [[ROLE.prubezne, ROLE.vysledky], ROLE.document];

/**
 * Sezóny (AdminSezony, AdminDialogSezona, AdminDialogSmazatSezonu): běžící
 * a připravené ročníky, pod nimi archiv; u každého dokumenty (rozbalí se),
 * úprava v dialogu, nastavení aktuální sezóny a smazání s potvrzením.
 * Data drží useSeasonManagement.
 */
export default function SeasonManagement() {
  // Hook sám nic nerenderuje, dialog proto vlastní tahle komponenta.
  const { confirm, confirmElement } = useConfirm();
  const sm = useSeasonManagement({ confirm });
  const { seasonId: fallbackSeasonId } = useCurrentSeason();
  const currentSeasonId = currentSeasonOf(sm.seasons, fallbackSeasonId);
  const { upcoming, archive } = splitSeasons(sm.seasons, currentSeasonId);

  const renderCard = (season, compact) => (
    <SeasonCard
      key={season.id}
      season={season}
      currentSeasonId={currentSeasonId}
      compact={compact}
      expanded={sm.expandedSeason === season.id}
      onToggle={sm.toggleDocuments}
      onEdit={sm.openEdit}
      onSetCurrent={sm.setCurrentSeason}
      onDelete={sm.deleteSeason}
    >
      <AttachmentManager
        ownerType={OWNER.season}
        ownerId={season.year_start}
        roles={SEASON_ROLES}
        title={`Dokumenty sezóny ${season.season_label}`}
        onChange={() => sm.reload()}
      />
    </SeasonCard>
  );

  return (
    <AdminPage
      title="Sezóny"
      meta={seasonsMeta(sm.seasons, currentSeasonId)}
      actions={
        <Button variant="primary" size="sm" icon="plus" onClick={sm.openCreate}>
          Nová sezóna
        </Button>
      }
    >
      {sm.message && (
        <Alert
          key={sm.message.text}
          type={sm.message.type}
          compact
          title={sm.message.text}
          onDismiss={() => sm.setMessage(null)}
        />
      )}
      {/* Spinner jen při prvním načtení – obnova po změně dokumentů nesmí
          odpojit rozbalený AttachmentManager (blikal by v nekonečné smyčce). */}
      {sm.loading && sm.seasons.length === 0 ? (
        <LoadingState label="Načítám sezóny…" />
      ) : sm.seasons.length === 0 ? (
        <EmptyState icon="calendar" title="Zatím žádná sezóna" />
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className={styles.section} aria-labelledby="sezony-bezici">
              <Paska id="sezony-bezici">Běžící a připravené</Paska>
              {upcoming.map((season) => renderCard(season, false))}
            </section>
          )}
          {archive.length > 0 && (
            <section className={styles.section} aria-labelledby="sezony-archiv">
              <Paska id="sezony-archiv">Archiv ročníků</Paska>
              {archive.map((season) => renderCard(season, true))}
            </section>
          )}
        </>
      )}
      {sm.showForm && (
        <SeasonDialog
          editing={sm.editing}
          formData={sm.formData}
          setFormData={sm.setFormData}
          saving={sm.saving}
          onSubmit={sm.handleSubmit}
          onClose={sm.closeForm}
        />
      )}
      {confirmElement}
    </AdminPage>
  );
}
