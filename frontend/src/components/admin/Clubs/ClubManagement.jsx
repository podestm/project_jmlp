import { OWNER, ROLE } from '../../../config/attachmentsApi.js';
import { Alert, ButtonLink, EmptyState, LoadingState } from '../../ms/index.js';
import AttachmentManager from '../Attachments/AttachmentManager.jsx';
import AdminPage from '../frame/AdminPage/AdminPage.jsx';
import ClubDeleteDialog from './ClubDeleteDialog/ClubDeleteDialog.jsx';
import ClubFilters from './ClubFilters/ClubFilters.jsx';
import ClubTable from './ClubTable/ClubTable.jsx';
import { clubCounts, clubsWord } from './clubs.js';
import { useClubManagement } from './useClubManagement.js';

const CLUB_ROLES = [ROLE.logo];

/**
 * Kluby a jejich loga (AdminKluby, AdminDialogSmazatKlub,
 * AdminDialogSmazatKlubBezZavodniku).
 *
 * Logo pořádajícího klubu se tiskne v hlavičce výsledkové listiny, proto se
 * nahrává tady - stejnou komponentou jako všechny ostatní dokumenty.
 */
export default function ClubManagement() {
  const cm = useClubManagement();
  const counts = clubCounts(cm.clubs);

  return (
    <AdminPage
      title="Kluby"
      meta={`${counts.total} ${clubsWord(counts.total)} · loga má ${counts.withLogo} z ${counts.organizers} pořadatelů`}
      actions={
        <ButtonLink to="/admin/club-requests" size="sm">
          Žádosti o kluby
        </ButtonLink>
      }
    >
      {cm.message && (
        <Alert
          key={cm.message.text}
          type={cm.message.type}
          compact
          title={cm.message.text}
          onDismiss={() => cm.setMessage(null)}
        />
      )}
      <ClubFilters cm={cm} counts={counts} />
      {/*
        Spinner jen při prvním načtení. Obnovení na pozadí (po nahrání loga)
        nesmí tabulku vyměnit za spinner - odpojilo by to AttachmentManager,
        ten by se po návratu připojil znovu, znovu ohlásil změnu a celá
        obrazovka by blikala v nekonečné smyčce.
      */}
      {cm.loading && cm.clubs.length === 0 ? (
        <LoadingState label="Načítám kluby…" />
      ) : cm.visibleClubs.length === 0 ? (
        <EmptyState icon="search-x" title="Žádný klub neodpovídá filtru" />
      ) : (
        <ClubTable
          clubs={cm.visibleClubs}
          expandedClub={cm.expandedClub}
          onToggleLogo={cm.toggleLogo}
          onDelete={cm.requestDelete}
          renderLogo={(club) => (
            <AttachmentManager
              ownerType={OWNER.club}
              ownerId={club.id}
              roles={CLUB_ROLES}
              title={`Logo klubu ${club.name}`}
              onChange={() => cm.load()}
            />
          )}
        />
      )}
      {cm.deleting && (
        <ClubDeleteDialog club={cm.deleting} clubs={cm.clubs} onResolve={cm.resolveDelete} />
      )}
    </AdminPage>
  );
}
