import { useMemo } from 'react';
import { Alert, ButtonLink, EmptyState, LoadingState } from '../../ms/index.js';
import AdminPage from '../frame/AdminPage/AdminPage.jsx';
import { pendingMeta } from './clubRequests.js';
import RequestCard from './RequestCard/RequestCard.jsx';
import { useClubRequests } from './useClubRequests.js';
import styles from './ClubRequests.module.css';

/**
 * Žádosti o přiřazení klubu (AdminZadosti, AdminMobilZadosti): závodník
 * napsal klub ručně, správce ho přiřadí k existujícímu nebo založí nový.
 * Chyba vyřízení je hláška nad frontou (AdminDialogChybaZadosti v kódu
 * jako dialog není). Data drží useClubRequests.
 */
export default function ClubRequests() {
  const cr = useClubRequests();
  const clubOptions = useMemo(
    () => cr.clubs.map((c) => ({ value: c.id, label: c.name })),
    [cr.clubs],
  );

  return (
    <AdminPage
      title="Žádosti o kluby"
      meta={cr.loading ? undefined : pendingMeta(cr.requests.length)}
      actions={
        <ButtonLink to="/admin/clubs" size="sm" icon="building">
          Správa klubů
        </ButtonLink>
      }
    >
      {cr.error && (
        <Alert type="danger" compact title={cr.error} onDismiss={() => cr.setError(null)} />
      )}
      {cr.loading ? (
        <LoadingState label="Načítám žádosti…" />
      ) : cr.requests.length === 0 ? (
        <EmptyState icon="check" title="Žádné nevyřízené žádosti" />
      ) : (
        <>
          <Alert type="warning" compact title="Bez přiřazení klubu se nepočítají body." />
          <div className={styles.list}>
            {cr.requests.map((request) => (
              <RequestCard
                key={request.registration_id}
                request={request}
                clubOptions={clubOptions}
                state={cr.stateOf(request.registration_id)}
                onChange={cr.update}
                onResolve={cr.resolve}
              />
            ))}
          </div>
        </>
      )}
    </AdminPage>
  );
}
