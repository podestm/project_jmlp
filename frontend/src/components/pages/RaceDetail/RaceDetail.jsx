import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Alert, Button, ButtonLink, Container, EmptyState, Icon, LoadingState, Panel, Paska, Screen } from '../../ms/index.js';
import { formatSeasonShort, getCurrentSeasonId } from '../../../utils/season.js';
import { raceSeasonId, registrationState, startOfToday } from '../../../utils/races.js';
import { raceTitle } from './raceDetail.js';
import { useRaceDetail, useRaceDetailRevalidation, useRaceRegistrations, useUpcomingRaces } from './useRaceDetail.js';
import RaceHero from './RaceHero.jsx';
import RaceResults from './RaceResults.jsx';
import RegisteredRacers from './RegisteredRacers.jsx';
import RegistrationClosed from './RegistrationClosed.jsx';
import RegistrationForm from './registration/RegistrationForm.jsx';
import styles from './RaceDetail.module.css';

/** Odkaz z kalendáře „Registrovat“ vede na #prihlaska – po načtení tam sjet. */
function useScrollToHash(ready) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [ready, hash]);
}

/** Závod minulé sezóny: upozornění a cesta na nejbližší závod letošní sezóny. */
function PastSeasonBanner({ race, nextRace }) {
  return (
    <div className={styles.banner}>
      <Container className={styles.bannerInner}>
        <Icon name="calendar" size={22} className={styles.bannerIcon} />
        <div className={styles.bannerText}>
          <p className={styles.bannerTitle}>Tohle je závod sezóny {formatSeasonShort(raceSeasonId(race) ?? race.season_id)}</p>
          {nextRace && <p>Nejbližší závod je {raceTitle(nextRace)}.</p>}
        </div>
        {nextRace && <ButtonLink to={`/zavod/${nextRace.id}`} iconEnd="arrow-right">Na závod {raceTitle(nextRace)}</ButtonLink>}
      </Container>
    </div>
  );
}

/** Pravý sloupec odjetého závodu: seznam přihlášených se po závodě nezveřejňuje. */
function RegistrationEnded() {
  return (
    <section className={styles.column} aria-labelledby="prihlasky">
      <Paska id="prihlasky">Přihlášky</Paska>
      <Panel padding="lg">
        <div className={styles.notice}>
          <span className={styles.noticeIcon}><Icon name="lock" size={22} /></span>
          <div className={styles.noticeText}>
            <h3 className={styles.noticeTitle}>Přihlašování skončilo před závodem</h3>
            <p>Kdo nakonec startoval a jak dojel, najdete ve výsledkové listině. Seznam přihlášených dětí po závodě už nezveřejňujeme.</p>
          </div>
        </div>
      </Panel>
    </section>
  );
}

/** Pravý sloupec uzavřeného závodu bez přihlášených. */
function ListAfterOpening() {
  return (
    <section className={styles.column} aria-labelledby="prihlaseni">
      <Paska id="prihlaseni">Přihlášení závodníci</Paska>
      <EmptyState
        size="lg"
        icon="lock"
        headingLevel={3}
        title="Seznam se ukáže s otevřením přihlášek"
        hint="Když pořadatel registraci otevře, objeví se tady formulář i přihlášení rozdělení podle klubů."
      />
    </section>
  );
}

/**
 * Detail závodu /zavod/:raceId (ZavodDetail, ZavodDetailUzavreno,
 * ZavodDetailOdjeto, PrihlaskaHledani, PrihlaskaChyby, MobilRegistrace,
 * MobilZavodDetail*). Stav přihlášek z utils/races.js určuje, co je vidět:
 * otevřeno → formulář a přihlášení; uzavřeno → co dělat dál; odjeto →
 * výsledky a body.
 */
export default function RaceDetail() {
  const { raceId } = useParams();
  const { race, status, reload } = useRaceDetail(raceId);
  const [refreshToken, setRefreshToken] = useState(0);
  const state = race ? registrationState(race, startOfToday()) : null;
  const registrations = useRaceRegistrations(raceId, { enabled: status === 'ready' && state !== 'past', refreshToken });
  const upcoming = useUpcomingRaces(status === 'ready' && state !== 'open');
  useRaceDetailRevalidation(reload, () => setRefreshToken((token) => token + 1));
  useScrollToHash(status === 'ready');

  if (status === 'loading') {
    return <Screen><Container className={styles.page}><LoadingState label="Načítám závod…" /></Container></Screen>;
  }

  if (status === 'notFound' || status === 'error') {
    const notFound = status === 'notFound';
    return (
      <Screen>
        <Container className={styles.page}>
          <Alert
            type={notFound ? 'danger' : 'warning'}
            title={notFound ? 'Tenhle závod v kalendáři nenajdeme' : 'Závod se nepodařilo načíst'}
            actions={notFound
              ? <ButtonLink to="/zavody" variant="primary" icon="arrow-left">Zpět na kalendář závodů</ButtonLink>
              : <Button variant="primary" icon="refresh" onClick={() => reload()}>Zkusit znovu</Button>}
          >
            {notFound
              ? 'Odkaz je nejspíš starý nebo neúplný. Závody od sezóny 2012/13 najdete v kalendáři.'
              : 'Server neodpověděl, nejspíš kvůli slabému signálu. Odkaz je v pořádku, zkuste to za chvíli znovu.'}
          </Alert>
        </Container>
      </Screen>
    );
  }

  const others = upcoming.filter((other) => other.id !== race.id);
  const nextOpenRace = others.find((other) => other.registration);
  const pastSeason = (raceSeasonId(race) ?? race.season_id) < getCurrentSeasonId();
  const registered = registrations.registrations?.total_racers ?? 0;

  return (
    <Screen>
      <RaceHero race={race} state={state} />
      {pastSeason && <PastSeasonBanner race={race} nextRace={others[0]} />}
      <Container className={styles.page}>
        <div className={styles.columns}>
          {state === 'open' && (
            <>
              <section className={styles.column} aria-labelledby="prihlaska">
                <Paska id="prihlaska">Přihláška závodníka</Paska>
                <Panel padding="lg">
                  <RegistrationForm raceId={Number(raceId)} onSuccess={() => setRefreshToken((token) => token + 1)} />
                </Panel>
              </section>
              <RegisteredRacers registrations={registrations.registrations} status={registrations.status} onRetry={registrations.reload} />
            </>
          )}
          {state === 'closed' && (
            <>
              <RegistrationClosed race={race} nextOpenRace={nextOpenRace} />
              {registrations.status === 'ready' && registered === 0
                ? <ListAfterOpening />
                : <RegisteredRacers registrations={registrations.registrations} status={registrations.status} onRetry={registrations.reload} />}
            </>
          )}
          {state === 'past' && (
            <>
              <div className={styles.columnStack}><RaceResults race={race} /></div>
              <RegistrationEnded />
            </>
          )}
        </div>
      </Container>
    </Screen>
  );
}
