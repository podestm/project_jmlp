import { useEffect, useState } from 'react';
import {
  Alert, Badge, BibDate, Button, ButtonLink, Container, EmptyState, Field, Icon, LoadingState, Paska, Screen, SegmentedControl,
  Select, Tooltip,
} from '../../ms/index.js';
import { formatDate, formatTime } from '../../../utils/date.js';
import { fixEncoding } from '../../../utils/text.js';
import { czechPlural, raceMethod, raceOrder } from '../../../utils/races.js';
import { POLL_MS, useCalmRaces, useLiveTiming } from './useLiveTiming.js';
import LiveResultsList from './LiveResultsList.jsx';
import LiveResultsTable from './LiveResultsTable.jsx';
import { rankEntriesByTime } from '../../../utils/results.js';
import { usePageMeta } from '../../../hooks/usePageMeta.js';
import { PAGE_META } from '../../../seo/pageMeta.js';
import styles from './Live.module.css';

const TIME_WITH_SECONDS = { hour: '2-digit', minute: '2-digit', second: '2-digit' };

/** Navy pás s ikonou v kruhu – klidový stav a konec přenosu (ZiveKlid). */
function StateBand({ icon, eyebrow, title, children }) {
  return (
    <div className={styles.band}>
      <Container className={styles.bandInner}>
        <span className={styles.bandIcon}><Icon name={icon} size={30} /></span>
        <div className={styles.bandText}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.bandTitle}>{title}</h1>
          {children}
        </div>
      </Container>
    </div>
  );
}

/** Karta závodu v klidovém stavu: datum jako startovní číslo a akce. */
function RaceCard({ label, race, tone, hint, action }) {
  return (
    <article className={styles.raceCard} data-tone={tone}>
      <p className={styles.cardLabel}>{label}</p>
      <div className={styles.cardMain}>
        <BibDate date={race.datum} variant="list" />
        <div className={styles.cardText}>
          <h3 className={styles.cardTitle}>{fixEncoding(race.areal_name)}</h3>
          <p className={styles.cardHint}>{hint}</p>
        </div>
      </div>
      {action}
    </article>
  );
}

/** Právě se nezávodí (ZiveKlid, MobilZiveKlid) – stránka se sama přepne, jakmile závod začne. */
function Calm() {
  const { next, last } = useCalmRaces(true);
  const describe = (race) => [fixEncoding(race.organizer_name), raceMethod(race).label.toLowerCase(), raceOrder(race) && `${raceOrder(race)}. závod sezóny`]
    .filter(Boolean).join(' · ');
  return (
    <>
      <StateBand icon="clock" eyebrow="Živé výsledky" title="Právě se nezávodí">
        <p className={styles.bandLead}>Přenos začne s prvním časem z trati.</p>
      </StateBand>
      {(next || last) && (
        <Container className={styles.page}>
          <section className={styles.section} aria-labelledby="nez-se-pojede">
            <Paska id="nez-se-pojede">Než se pojede</Paska>
            <div className={styles.cards}>
              {next && (
                <RaceCard label="Nejbližší závod" race={next} tone="open" hint={describe(next)}
                  action={<ButtonLink to={`/zavod/${next.id}`} iconEnd="arrow-right">Detail závodu</ButtonLink>} />
              )}
              {last && (
                <RaceCard label="Poslední odjetý závod" race={last} tone="neutral" hint={describe(last)}
                  action={<ButtonLink to={`/zavod/${last.id}`} icon="arrow-right">Oficiální výsledky závodu</ButtonLink>} />
              )}
            </div>
          </section>
        </Container>
      )}
    </>
  );
}

/** Závod skončil během sledování. */
function Ended({ race }) {
  return (
    <>
      <StateBand icon="flag" eyebrow="Živé výsledky" title="Živé vysílání skončilo">
        <p className={styles.bandLead}>{race?.name} · Oficiální výsledky budou u závodu.</p>
      </StateBand>
      <Container className={styles.page}>
        <div className={styles.endedActions}>
          {race?.id && <ButtonLink to={`/zavod/${race.id}`} variant="primary" icon="trophy">Výsledky závodu</ButtonLink>}
          <ButtonLink to="/" icon="home">Úvod</ButtonLink>
        </div>
      </Container>
    </>
  );
}

/** Souhrn kategorie: počet a kolik jich je v cíli. */
const categorySummary = (entries) => {
  const finished = entries.filter((entry) => !entry.status && entry.time_sum != null).length;
  const out = entries.filter((entry) => entry.status).length;
  return [
    `${entries.length} ${czechPlural(entries.length, ['závodník', 'závodníci', 'závodníků'])}`,
    `${finished} v cíli`,
    out > 0 && `${out} bez času`,
  ].filter(Boolean).join(' · ');
};

function Running({ data, stale, lastUpdate, refresh }) {
  // Pilulky v obráceném pořadí API (od nejmladších); vybraná je první zobrazená.
  const categories = [...(data.categories || [])].reverse();
  const [selectedId, setSelectedId] = useState('');
  useEffect(() => {
    if (!categories.some((category) => String(category.category_id) === selectedId)) {
      setSelectedId(categories.length ? String(categories[0].category_id) : '');
    }
  }, [categories, selectedId]);
  const selected = categories.find((category) => String(category.category_id) === selectedId);
  const ranked = selected ? rankEntriesByTime(selected.entries) : [];
  const categoryOptions = categories.map((category) => ({
    value: String(category.category_id),
    label: `${category.category_name} (${category.entries.length})`,
  }));
  const meta = [data.race_nr, data.race_date && formatDate(data.race_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    data.race_method_id && raceMethod(data).label.toLowerCase()].filter(Boolean).join(' · ');

  return (
    <>
      <div className={styles.band}>
        <Container className={styles.liveHead}>
          <div className={styles.liveTitle}>
            <Badge tone="live">Živě</Badge>
            <h1 className={styles.bandTitle}>{fixEncoding(data.areal_name)}</h1>
            <p className={styles.bandLead}>{meta}</p>
          </div>
          <div className={styles.refresh}>
            <p className={styles.updated}>Aktualizováno <span className={styles.clock}>{lastUpdate ? formatTime(lastUpdate, TIME_WITH_SECONDS) : '—'}</span></p>
            <Tooltip text={`Samo každých ${POLL_MS / 1000} s`}>
              <Button variant="on-dark" size="sm" icon="refresh" onClick={refresh}>Obnovit</Button>
            </Tooltip>
          </div>
        </Container>
      </div>
      <div className={styles.warning}>
        <Container className={styles.warningInner}>
          <Icon name="warning" size={20} />
          <p><strong>Neoficiální výsledky.</strong> Oficiální listina vyjde po závodě.</p>
        </Container>
      </div>
      <Container className={styles.page}>
        {stale && (
          <Alert type="warning" title="Spojení vypadlo">
            Zobrazujeme poslední data z {lastUpdate ? formatTime(lastUpdate, TIME_WITH_SECONDS) : '—'}. Zkoušíme to znovu každých {POLL_MS / 1000} s.
          </Alert>
        )}
        {categories.length === 0 ? (
          <EmptyState size="lg" icon="clock" title="Čeká se na první časy" />
        ) : (
          <>
            {/* Na počítači řada tlačítek, na telefonu výběr (MobilZive) – CSS ukáže jedno z nich. */}
            <div className={styles.categories}>
              <span className={styles.categoriesLabel} aria-hidden="true">Kategorie</span>
              <SegmentedControl label="Kategorie" options={categoryOptions} value={selectedId} onChange={setSelectedId} />
            </div>
            <Field label="Kategorie" className={styles.categorySelect}>
              <Select size="lg" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </Field>
            {selected && (
              <section className={styles.category} aria-labelledby="kategorie">
                <header className={styles.categoryHead}>
                  <h2 id="kategorie" className={styles.categoryTitle}>{selected.category_name}</h2>
                  <p className={styles.categoryMeta}>{categorySummary(selected.entries)}</p>
                </header>
                <LiveResultsTable category={selected} ranked={ranked} className={styles.desktopOnly} />
                <LiveResultsList ranked={ranked} className={styles.mobileOnly} />
              </section>
            )}
          </>
        )}
      </Container>
    </>
  );
}

/** Živé výsledky /zive (Zive, ZiveKlid, MobilZive, MobilZiveKlid). */
export default function Live() {
  usePageMeta(PAGE_META.live);
  const live = useLiveTiming();

  let content;
  if (live.status === 'loading') content = <Container className={styles.page}><LoadingState label="Načítám živé výsledky…" /></Container>;
  else if (live.status === 'error') {
    content = (
      <Container className={styles.page}>
        <Alert type="danger" title="Živé výsledky se nepodařilo načíst"
          actions={<Button variant="primary" icon="refresh" onClick={live.refresh}>Zkusit znovu</Button>}>
          Nejspíš vypadlo připojení. Stránka to bude zkoušet dál sama každých {POLL_MS / 1000} s.
        </Alert>
      </Container>
    );
  } else if (live.status === 'calm') content = <Calm />;
  else if (live.status === 'ended') content = <Ended race={live.lastRace} />;
  else content = <Running data={live.data} stale={live.stale} lastUpdate={live.lastUpdate} refresh={live.refresh} />;

  return <Screen>{content}</Screen>;
}
