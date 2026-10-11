import { Link } from 'react-router-dom';
import {
  Alert, Badge, BibDate, Button, ButtonLink, Container, DataRow, EmptyState, Icon, LoadingState, Panel, Paska, Screen,
} from '../../ms/index.js';
import PostCard from '../../site/PostCard/PostCard.jsx';
import { useSeasonInfo } from '../../site/siteInfo.js';
import { useLiveStatus } from '../../../contexts/LiveStatusContext.jsx';
import { fixEncoding } from '../../../utils/text.js';
import { REGISTRATION_STATE, raceDate, raceMethod, registrationState, startOfToday } from '../../../utils/races.js';
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
          <ButtonLink to={registerPath(openRace)} variant="inverse" size="lg" iconEnd="arrow-right">Přihlásit na závod</ButtonLink>
          <ButtonLink to="/zavody" variant="on-dark" size="lg">Kalendář sezóny</ButtonLink>
        </div>
        <p className={styles.since}><span className={styles.sinceYear}>2006</span>jezdíme od roku</p>
      </Container>
    </div>
  );
}

/** Červený pás, když se právě závodí (LiveStatusContext). */
function LiveBanner({ liveRace }) {
  return (
    <Link to="/zive" className={styles.live}>
      <Container className={styles.liveInner}>
        <span className={styles.liveDot} aria-hidden="true" />
        <span className={styles.liveText}>
          <strong>Právě se závodí – {fixEncoding(liveRace.areal_name)}</strong>
          <span>Průběžné neoficiální výsledky sledujte živě.</span>
        </span>
        <span className={styles.liveAction}>Živé výsledky <Icon name="arrow-right" size={18} /></span>
      </Container>
    </Link>
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
      className={styles.nextRace}
      lead={<BibDate date={race.datum} variant="list" />}
      title={(
        <>
          <span className={styles.nextEyebrow}>Nejbližší závod</span>
          <Link to={`/zavod/${race.id}`} className={styles.raceLink}>{fixEncoding(race.areal_name)}</Link>
        </>
      )}
      meta={meta}
      aside={state === 'open'
        ? <ButtonLink to={registerPath(race)} variant="primary" iconEnd="arrow-right">Přihlásit závodníka</ButtonLink>
        : <ButtonLink to={`/zavod/${race.id}`} iconEnd="arrow-right">Detail závodu</ButtonLink>}
    />
  );
}

function SeasonRaces({ races, today }) {
  const { season } = useSeasonInfo();
  let content;
  if (races.status === 'loading') content = <LoadingState variant="inline" label="Načítám závody…" />;
  else if (races.status === 'error') {
    content = (
      <Alert type="danger" compact title="Závody se nepodařilo načíst"
        actions={<Button size="sm" icon="refresh" onClick={() => races.load()}>Zkusit znovu</Button>}>
        Kalendář je i na stránce Závody.
      </Alert>
    );
  } else if (races.list.length === 0) {
    content = <EmptyState icon="calendar" headingLevel={3} title="V sezóně zatím nejsou vypsané žádné závody" hint="Termíny se objeví, jakmile je pořadatelé potvrdí." />;
  } else {
    content = (
      <Panel as="ul" padding="none" className={styles.raceList}>
        {races.list.map((race) => {
          const status = REGISTRATION_STATE[registrationState(race, today)];
          return (
            <DataRow
              key={race.id}
              as="li"
              tone={status.bar}
              lead={<BibDate date={race.datum} variant="row" />}
              title={<Link to={`/zavod/${race.id}`} className={styles.raceLink}>{fixEncoding(race.areal_name)}</Link>}
              meta={fixEncoding(race.organizer_name)}
            >
              <Badge tone={status.badge} size="sm" className={styles.rowBadge}>{status.label}</Badge>
            </DataRow>
          );
        })}
      </Panel>
    );
  }
  return (
    <section className={styles.section} aria-labelledby="sezona">
      <Paska id="sezona" aside={<Link to="/zavody" className={styles.more}>Celý kalendář →</Link>}>Sezóna {season}</Paska>
      {content}
    </section>
  );
}

function News({ posts }) {
  let content;
  if (posts.status === 'loading') content = <LoadingState label="Načítám aktuality…" />;
  else if (posts.status === 'error') {
    content = (
      <Alert type="danger" compact title="Aktuality se nepodařilo načíst"
        actions={<Button size="sm" icon="refresh" onClick={() => posts.load()}>Zkusit znovu</Button>}>
        Zkuste to prosím za chvíli znovu.
      </Alert>
    );
  } else if (posts.data.length === 0) {
    content = <EmptyState icon="news" headingLevel={3} title="Zatím tu nejsou žádné aktuality" />;
  } else {
    content = (
      <div className={styles.news}>
        {posts.data.map((post) => <PostCard key={post.id} post={post} variant="teaser" headingLevel={3} />)}
      </div>
    );
  }
  return (
    <section className={styles.section} aria-labelledby="aktuality">
      <Paska id="aktuality" aside={<Link to="/aktuality" className={styles.more}>Starší zprávy →</Link>}>Aktuality</Paska>
      {content}
    </section>
  );
}

/** Úvod / (Main.dc.html, MobilUvod.dc.html). */
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
      {liveRace && <LiveBanner liveRace={liveRace} />}
      <Container className={styles.page}>
        {nextRace && <NextRace race={nextRace} />}
        <section className={styles.about} aria-labelledby="pro-koho">
          <Paska id="pro-koho">Pro koho je pohár</Paska>
          <p>JMLP je regionální seriál pro děti a mládež, které lyžují v klubu, i pro ty, které chtějí závodit poprvé.</p>
        </section>
        <SeasonRaces races={{ ...races, list: seasonRaces }} today={today} />
        <News posts={posts} />
      </Container>
    </Screen>
  );
}
