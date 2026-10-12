import { Link } from 'react-router-dom';
import { BibDate, ButtonLink, Container, DataRow, LiveBand, Screen } from '../../ms/index.js';
import { useSeasonInfo } from '../../site/siteInfo.js';
import { useLiveStatus } from '../../../contexts/LiveStatusContext.jsx';
import { fixEncoding } from '../../../utils/text.js';
import { REGISTRATION_STATE, raceDate, raceMethod, registrationState, startOfToday } from '../../../utils/races.js';
import LatestNews from './LatestNews/LatestNews.jsx';
import SeasonRaces from './SeasonRaces/SeasonRaces.jsx';
import { useHome } from './useHome.js';
import { usePageMeta } from '../../../hooks/usePageMeta.js';
import { PAGE_META } from '../../../seo/pageMeta.js';
import styles from './Home.module.css';

/** Odkaz na přihlášku: na detail otevřeného závodu, jinak do kalendáře. */
const registerPath = (race) => (race?.registration ? `/zavod/${race.id}#prihlaska` : '/zavody');

function Hero({ openRace }) {
  const { edition, season } = useSeasonInfo();
  return (
    <div className={styles.hero}>
      <Container className={styles.heroInner}>
        <p className={styles.eyebrow}>{edition} ročník · sezóna {season}</p>
        <h1 className={styles.heroTitle}>Jihomoravský Lyžařský Pohár</h1>
        <p className={styles.lead}>Seriál závodů na sněhu i na suchu, od Myšáků po dospělé (OPEN).</p>
        <div className={styles.heroActions}>
          <ButtonLink to={registerPath(openRace)} variant="accent" size="lg" iconEnd="arrow-right">Přihlásit na závod</ButtonLink>
          <ButtonLink to="/zavody" variant="on-dark" size="lg">Kalendář sezóny</ButtonLink>
        </div>
        <p className={styles.since}><span className={styles.sinceYear}>2006</span>jezdíme od roku</p>
      </Container>
    </div>
  );
}

/** Nejbližší závod jako karta s hlavní akcí. */
function NextRace({ race }) {
  const state = registrationState(race);
  const meta = [fixEncoding(race.organizer_name), raceMethod(race).label.toLowerCase()].filter(Boolean).join(' · ');
  return (
    <DataRow
      variant="card"
      tone={REGISTRATION_STATE[state].bar}
      raised
      eyebrow="Nejbližší závod"
      lead={<BibDate date={race.datum} variant="list" />}
      title={<Link to={`/zavod/${race.id}`} className={styles.raceLink}>{fixEncoding(race.areal_name)}</Link>}
      meta={meta}
      aside={state === 'open'
        ? <ButtonLink to={registerPath(race)} variant="primary" iconEnd="arrow-right">Přihlásit závodníka</ButtonLink>
        : <ButtonLink to={`/zavod/${race.id}`} iconEnd="arrow-right">Detail závodu</ButtonLink>}
    />
  );
}

/**
 * Úvod / (Main.dc.html, MobilUvod.dc.html): hrdina, nejbližší závod a pod ním
 * vedle sebe aktuality (2/3) a závody sezóny (1/3) jako na jmlp.cz.
 */
export default function Home() {
  usePageMeta(PAGE_META.home);
  const liveRace = useLiveStatus();
  const { posts, races } = useHome();
  const today = startOfToday();
  const seasonRaces = [...races.data].sort((a, b) => raceDate(a) - raceDate(b));
  const upcoming = seasonRaces.filter((race) => registrationState(race, today) !== 'past');
  const nextRace = upcoming[0];
  const openRace = upcoming.find((race) => race.registration);

  return (
    <Screen>
      <Hero openRace={openRace} />
      {liveRace && (
        <LiveBand title={`Právě se závodí – ${fixEncoding(liveRace.areal_name)}`} detail="Průběžné neoficiální výsledky sledujte živě." />
      )}
      <Container className={styles.page}>
        {nextRace && <NextRace race={nextRace} />}
        {/* Závody jsou v DOM první: pod 1024 px stojí hned pod nejbližším
            závodem (přihlášky jsou nejdůležitější), na šířku vpravo. */}
        <div className={styles.columns}>
          <SeasonRaces races={{ ...races, list: seasonRaces }} today={today} className={styles.races} />
          <LatestNews posts={posts} className={styles.news} />
        </div>
      </Container>
    </Screen>
  );
}
