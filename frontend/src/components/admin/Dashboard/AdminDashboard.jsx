import { Link } from 'react-router-dom';
import { ButtonLink, IconButton, LoadingState, Paska } from '../../ms/index.js';
import AdminPage from '../frame/AdminPage/AdminPage.jsx';
import ClubRequestsBanner from './ClubRequestsBanner/ClubRequestsBanner.jsx';
import DashboardError from './DashboardError/DashboardError.jsx';
import QuickActions from './QuickActions/QuickActions.jsx';
import RecentPosts from './RecentPosts/RecentPosts.jsx';
import RecentRegistrations from './RecentRegistrations/RecentRegistrations.jsx';
import StatTile from './StatTile/StatTile.jsx';
import TopPages from './TopPages/TopPages.jsx';
import UpcomingRace from './UpcomingRace/UpcomingRace.jsx';
import VisitsChart from './VisitsChart/VisitsChart.jsx';
import { formatCount, todayLabel } from './dashboard.js';
import { useDashboard } from './useDashboard.js';
import styles from './AdminDashboard.module.css';

/** Dlaždice s čísly; bez dat (chyba) zůstanou na místě s pomlčkami. */
function StatTiles({ data }) {
  const counts = data?.counts;
  const race = data?.upcoming_race;
  return (
    <div className={styles.tiles}>
      <StatTile
        label="Závodníků v databázi"
        value={counts && formatCount(counts.total_racers)}
        hint={counts && `${counts.total_clubs} aktivních klubů`}
      />
      <StatTile
        label="Závodů v sezóně"
        value={counts && formatCount(counts.season_races)}
        hint={counts && `${counts.open_registrations} s otevřenou registrací`}
      />
      <StatTile
        label={
          race?.areal_name ? `Přihlášek na ${race.areal_name}` : 'Přihlášek na nejbližší závod'
        }
        value={data && (race ? formatCount(race.registration_count) : '0')}
        hint={race ? race.race_nr : 'žádný vypsaný závod'}
        tone="open"
      />
      <StatTile
        label="Souborů v knihovně"
        value={counts && formatCount(counts.file_count)}
        hint={counts && `celkem ${counts.storage_size}`}
      />
    </div>
  );
}

/**
 * Přehled administrace (AdminDashboard, AdminMobilPrehled, AdminPrehledChyba):
 * nevyřízené žádosti o kluby, čísla, nejbližší závod, poslední přihlášky,
 * návštěvnost, příspěvky, nejnavštěvovanější stránky a rychlé akce.
 */
export default function AdminDashboard() {
  const { data, loading, error, reload } = useDashboard();

  const page = (children) => (
    <AdminPage
      title="Přehled"
      meta={data ? `${todayLabel()} · sezóna ${data.season.label}` : todayLabel()}
      actions={
        <>
          <ButtonLink to="/admin/races" variant="primary" size="sm" icon="plus">
            Nový závod
          </ButtonLink>
          <ButtonLink href="/" target="_blank" rel="noreferrer" size="sm" icon="external-link">
            Veřejný web
          </ButtonLink>
          <IconButton icon="refresh" label="Obnovit přehled" onClick={reload} />
        </>
      }
    >
      {children}
    </AdminPage>
  );

  if (loading && !data) return page(<LoadingState label="Načítám přehled…" />);

  // Chyba bez dat: hláška bez křížku a prázdné dlaždice (dřív zavření
  // hlášky shodilo obrazovku – data pořád chyběla).
  if (!data) {
    return page(
      <>
        <DashboardError message={error} onRetry={reload} />
        <StatTiles data={null} />
      </>,
    );
  }

  const {
    counts,
    visits,
    upcoming_race: upcomingRace,
    recent_registrations: registrations,
    top_pages: topPages,
    recent_posts: posts,
  } = data;

  return page(
    <>
      {counts.pending_club_requests > 0 && (
        <ClubRequestsBanner count={counts.pending_club_requests} />
      )}

      <StatTiles data={data} />

      <div className={styles.split}>
        <section className={styles.race} aria-labelledby="prehled-zavod">
          <Paska id="prehled-zavod">Nejbližší závod</Paska>
          <UpcomingRace race={upcomingRace} />
        </section>
        <section className={styles.registrations} aria-labelledby="prehled-prihlasky">
          <Paska
            id="prehled-prihlasky"
            aside={
              <Link to="/admin/races" className={styles.asideLink}>
                Všechny závody →
              </Link>
            }
          >
            Poslední přihlášky
          </Paska>
          <RecentRegistrations registrations={registrations} />
        </section>
      </div>

      <section className={styles.section} aria-labelledby="prehled-navstevnost">
        <Paska id="prehled-navstevnost">Návštěvnost webu</Paska>
        <VisitsChart today={visits.today} todayUnique={visits.today_unique} />
      </section>

      <div className={styles.columns}>
        <section className={styles.section} aria-labelledby="prehled-prispevky">
          <Paska
            id="prehled-prispevky"
            aside={<span className={styles.asideText}>celkem {counts.total_posts}</span>}
          >
            Poslední příspěvky
          </Paska>
          <RecentPosts posts={posts} />
        </section>
        <section className={styles.section} aria-labelledby="prehled-stranky">
          <Paska id="prehled-stranky" aside={<span className={styles.asideText}>30 dní</span>}>
            Nejnavštěvovanější stránky
          </Paska>
          <TopPages pages={topPages} />
        </section>
        <section className={styles.section} aria-labelledby="prehled-akce">
          <Paska id="prehled-akce">Rychlé akce</Paska>
          <QuickActions />
        </section>
      </div>
    </>,
  );
}
