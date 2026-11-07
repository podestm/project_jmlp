import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  LoadingState,
  Tooltip,
} from '../../ms/index.js';
import AdminPage from '../frame/AdminPage/AdminPage.jsx';
import RaceInfo from '../shared/RaceInfo/RaceInfo.jsx';
import { raceSubtitle } from '../shared/raceText.js';
import RegistrationFilters from './RegistrationFilters/RegistrationFilters.jsx';
import RegistrationList from './RegistrationList/RegistrationList.jsx';
import RegistrationStats from './RegistrationStats/RegistrationStats.jsx';
import RegistrationTable from './RegistrationTable/RegistrationTable.jsx';
import WaitingClubNotice from './WaitingClubNotice/WaitingClubNotice.jsx';
import {
  EMPTY_FILTER,
  categoryOptions,
  clubOptions,
  filterRegistrations,
  groupRegistrations,
  isFiltered,
  raceMeta,
  registrationStats,
} from './registrations.js';
import { useAdminRaceRegistrations } from './useAdminRaceRegistrations.js';

/** Seznam přihlášených podle filtru a řazení; prázdný filtr řekne proč. */
function RegistrationsBody({ registrations }) {
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [sort, setSort] = useState('club');
  const shown = useMemo(() => filterRegistrations(registrations, filter), [registrations, filter]);
  const groups = useMemo(() => groupRegistrations(shown, sort), [shown, sort]);
  const reset = () => setFilter(EMPTY_FILTER);

  return (
    <>
      <RegistrationFilters
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        clubs={clubOptions(registrations)}
        categories={categoryOptions(registrations)}
        shown={shown.length}
        total={registrations.length}
        filtered={isFiltered(filter)}
        onReset={reset}
      />
      {shown.length === 0 ? (
        <EmptyState
          icon="search-x"
          title="Filtru nikdo neodpovídá"
          action={
            <Button size="sm" onClick={reset}>
              Zrušit filtr
            </Button>
          }
        />
      ) : (
        <>
          <RegistrationTable groups={groups} />
          <RegistrationList groups={groups} />
        </>
      )}
    </>
  );
}

/**
 * Přihlášky k závodu (AdminPrihlasky, AdminMobilPrihlasky): karta závodu,
 * počty, filtr a seznam přihlášených po klubech. Jen ke čtení – export CSV
 * a registrace se ovládají ve správě závodů.
 */
export default function RaceRegistrations() {
  const { raceId } = useParams();
  const { race, registrations, loading, error } = useAdminRaceRegistrations(raceId);
  const stats = useMemo(() => registrationStats(registrations), [registrations]);

  const actions = (
    <>
      <Tooltip text="Ve správě závodů">
        <ButtonLink to="/admin/races" size="sm" icon="download">
          Export CSV
        </ButtonLink>
      </Tooltip>
      <ButtonLink to="/admin/races" size="sm" icon="arrow-left">
        Zpět na závody
      </ButtonLink>
    </>
  );

  const content = () => {
    if (loading) return <LoadingState label="Načítám přihlášky…" />;
    if (error) {
      return (
        <Alert type="danger" title="Přihlášky se nepodařilo načíst.">
          {error}
        </Alert>
      );
    }
    return (
      <>
        {race && (
          <RaceInfo
            race={race}
            size="lg"
            meta={[race.race_nr, raceSubtitle(race)].filter(Boolean).join(' · ')}
            aside={
              <Badge tone={race.registration ? 'open' : 'neutral'} size="sm">
                {race.registration ? 'Registrace otevřená' : 'Registrace uzavřená'}
              </Badge>
            }
          />
        )}
        <RegistrationStats stats={stats} />
        <WaitingClubNotice count={stats.waitingForClub} />
        {registrations.length === 0 ? (
          <EmptyState icon="user" title="Žádní registrovaní závodníci" />
        ) : (
          <RegistrationsBody registrations={registrations} />
        )}
      </>
    );
  };

  return (
    <AdminPage
      title="Přihlášky k závodu"
      meta={loading ? null : raceMeta(race, raceId)}
      actions={actions}
    >
      {content()}
    </AdminPage>
  );
}
