import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, EmptyState, Grid, Icon, LoadingState, PageHeader, Panel, Paska } from '../../ms/index.js';
import { czechPlural } from '../../../utils/races.js';
import { useCurrentSeason } from '../../../hooks/useCurrentSeason.js';
import { seasonInfo } from '../../site/siteInfo.js';
import TkPage from '../frame/TkPage/TkPage.jsx';
import { readSelectedRaceId, storeSelectedRaceId } from '../frame/selectedRace.js';
import { czechDateParts } from '../../ms/BibDate/czechDate.js';
import { formatDateShort } from '../../../utils/date.js';
import { splitRaces, splitRecentPast } from './dashboard.js';
import PastRaceRow from './PastRaceRow.jsx';
import RaceCard from './RaceCard.jsx';
import { useTimekeeperRaces } from './useTimekeeperRaces.js';
import styles from './TimekeeperDashboard.module.css';

/**
 * Výběr závodu (TkVyberZavodu) – jediné místo, kde se závod přepíná.
 * Naposledy vybraný závod nahoře, pod ním nadcházející a proběhlé závody
 * jako karty se živým přenosem.
 */
export default function TimekeeperDashboard() {
  const { races, loading, error, clearError, loadRaces, toggleLive } = useTimekeeperRaces();
  const navigate = useNavigate();
  const currentSeason = useCurrentSeason();
  const { edition, season } = seasonInfo(currentSeason);
  const [showOlder, setShowOlder] = useState(false);

  const selectRace = (raceId) => {
    storeSelectedRaceId(raceId);
    navigate('/timekeeper/start-list');
  };

  const header = (
    <PageHeader
      variant="app"
      title="Na kterém závodě dnes měříte?"
      meta="Výběr si notebook zapamatuje, ostatní obrazovky ho jen čtou."
      actions={(
        <>
          <span className={styles.season}>Sezóna {season} · {edition} ročník</span>
          <Button icon="refresh" size="sm" onClick={loadRaces}>Obnovit</Button>
        </>
      )}
    />
  );

  if (loading) {
    return (
      <TkPage>
        {header}
        <LoadingState label="Načítám závody…" />
      </TkPage>
    );
  }

  const { upcoming, past } = splitRaces(races);
  // Starší než předchozí sezóna jen na požádání (jinak přes sto řádků).
  const { recent, older } = splitRecentPast(past, currentSeason.seasonId);
  const shownPast = showOlder ? past : recent;
  const selectedId = readSelectedRaceId();
  const lastRace = races.find((race) => String(race.id) === String(selectedId));

  const rowProps = (race) => ({
    race,
    selected: String(race.id) === String(selectedId),
    onSelect: selectRace,
    onToggleLive: toggleLive,
  });

  const count = (n) => `${n} ${czechPlural(n, ['závod', 'závody', 'závodů'])}`;

  return (
    <TkPage>
      {header}

      {error && (
        <Alert type="danger" compact onDismiss={clearError} actions={<Button size="sm" icon="refresh" onClick={loadRaces}>Obnovit</Button>}>
          {error}
        </Alert>
      )}

      {lastRace ? (
        <section className={styles.last} aria-label="Naposledy vybraný závod">
          <Icon name="history" size={28} className={styles.lastIcon} />
          <div className={styles.lastText}>
            <span className={styles.lastCaps}>Naposledy vybraný závod</span>
            <span className={styles.lastRace}>
              <span className={styles.lastName}>{lastRace.areal_name || 'Neznámé místo'}</span>
              {lastRace.datum && (
                <>
                  <span className={styles.lastWeekday}>{czechDateParts(lastRace.datum).weekdayShort}</span>
                  <span className={styles.lastDate}>{formatDateShort(lastRace.datum)}</span>
                </>
              )}
            </span>
          </div>
          <Button variant="primary" size="lg" iconEnd="arrow-right" onClick={() => selectRace(lastRace.id)}>
            Pokračovat v měření
          </Button>
        </section>
      ) : races.length > 0 && (
        <p className={styles.pick}>Závod si vyberte z nabídky níže.</p>
      )}

      {upcoming.length > 0 && (
        <section className={styles.section}>
          <Paska aside={count(upcoming.length)}>Nadcházející závody</Paska>
          <Grid min="480px" gap={4}>
            {upcoming.map((race) => <RaceCard key={race.id} {...rowProps(race)} />)}
          </Grid>
        </section>
      )}

      {past.length > 0 && (
        <section className={styles.section}>
          <Paska aside={count(shownPast.length)}>Proběhlé závody</Paska>
          {shownPast.length > 0 && (
            <Panel as="ul" padding="none">
              {shownPast.map((race) => <PastRaceRow key={race.id} {...rowProps(race)} />)}
            </Panel>
          )}
          {older.length > 0 && (
            <Button
              icon={showOlder ? 'chevron-up' : 'chevron-down'}
              aria-expanded={showOlder}
              className={styles.older}
              onClick={() => setShowOlder(!showOlder)}
            >
              {showOlder ? 'Skrýt starší závody' : `Zobrazit starší závody (${older.length})`}
            </Button>
          )}
        </section>
      )}

      {races.length === 0 && !error && (
        <EmptyState icon="calendar-x" title="Žádné závody v aktuální sezóně" hint="Závody vypisuje komisař soutěže v administraci webu." />
      )}
    </TkPage>
  );
}
