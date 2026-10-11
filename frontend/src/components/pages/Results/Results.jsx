import { useEffect, useState } from 'react';
import {
  Alert, Badge, BibDate, Button, ButtonLink, Container, DataRow, EmptyState, Field, LoadingState, PageHeader, Paska, Screen,
  SegmentedControl, Select,
} from '../../ms/index.js';
import { useRaceCalendar } from '../../../hooks/useRaceCalendar.js';
import { fixEncoding } from '../../../utils/text.js';
import { formatSeasonShort, getCurrentSeasonId, seasonEdition, toRoman } from '../../../utils/season.js';
import { raceDate, raceMethod, raceOrder, raceSeasonId, seasonLabel, seasonsOf, startOfToday } from '../../../utils/races.js';
import { standingsEyebrow } from './standings.js';
import { useStandings } from './useStandings.js';
import StandingsList from './StandingsList.jsx';
import StandingsTable from './StandingsTable.jsx';
import styles from './Results.module.css';

const API_BASE = import.meta.env.VITE_API_BASE || '';

/** Odjeté závody sezóny s odkazem na detail a oficiální listinu. */
function SeasonRaces({ races }) {
  if (races.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="zavody-sezony">
      <Paska id="zavody-sezony">Výsledky jednotlivých závodů</Paska>
      <ul className={styles.raceList}>
        {races.map((race) => (
          <DataRow
            key={race.id}
            as="li"
            variant="card"
            tone="neutral"
            lead={<BibDate date={race.datum} variant="list" />}
            title={fixEncoding(race.areal_name)}
            meta={[raceMethod(race).label, raceOrder(race) && `${raceOrder(race)}. závod sezóny`].filter(Boolean).join(' · ')}
            aside={(
              <div className={styles.raceActions}>
                <ButtonLink to={`/zavod/${race.id}`} size="sm">Detail závodu</ButtonLink>
                {race.results_file_id
                  ? <ButtonLink href={`${API_BASE}/races/${race.id}/results`} target="_blank" rel="noopener noreferrer" size="sm" variant="primary" icon="download">Oficiální PDF</ButtonLink>
                  : <Badge tone="neutral">Listina zatím není</Badge>}
              </div>
            )}
          />
        ))}
      </ul>
    </section>
  );
}

/** Pořadí poháru: výběr kategorie, tabulka (na telefonu řádky) a pravidla. */
function Standings({ standings }) {
  const [categoryId, setCategoryId] = useState(null);
  const categories = standings.categories;
  const selected = categories.find((category) => category.category_id === categoryId) ?? categories[0];
  useEffect(() => { setCategoryId(null); }, [standings]);
  const options = categories.map((category) => ({ value: category.category_id, label: category.name }));
  const title = standings.final ? 'Celkové výsledky' : 'Průběžné pořadí';

  return (
    <section className={styles.section} aria-labelledby="poradi">
      <Paska id="poradi" aside={<span className={styles.note}>Body a pořadí podle soutěžního řádu – stejně jako v PDF, které zveřejňuje časomíra.</span>}>
        {title}
      </Paska>
      {standings.races_without_results > 0 && (
        <Alert type="warning" compact title="Pořadí není úplné">
          {standings.races_without_results} {standings.races_without_results === 1 ? 'odjetý závod má' : 'odjeté závody mají'} výsledky
          jen v PDF listině, a proto v pořadí zatím chybí.
        </Alert>
      )}
      {/* Na počítači tlačítka, na telefonu výběr – CSS ukáže jedno z nich. */}
      <div className={styles.categories}>
        <span className={styles.categoriesLabel} aria-hidden="true">Kategorie</span>
        <SegmentedControl label="Kategorie" options={options} value={selected.category_id} onChange={setCategoryId} />
      </div>
      <Field label="Kategorie" className={styles.categorySelect}>
        <Select size="lg" value={selected.category_id} onChange={(event) => setCategoryId(Number(event.target.value))}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </Field>
      <StandingsTable category={selected} races={standings.races} className={styles.desktopOnly} />
      <StandingsList category={selected} className={styles.mobileOnly} />
      <div className={styles.rules}>
        <p className={styles.legend}>
          <span className={styles.swatch} data-kind="P" aria-hidden="true" /> Započtený přípravný závod
          <span className={styles.swatch} data-kind="S" aria-hidden="true" /> Započtený závod na sněhu
        </p>
        <p>
          Do pořadí se započítá 1 nejlepší přípravný závod a 3 nejlepší závody na sněhu. Body z přípravných závodů se
          započtou jen tomu, kdo jel aspoň jeden závod na sněhu. Při shodě bodů rozhoduje víc lepších umístění
          v započtených závodech na sněhu, pak ve všech závodech na sněhu, součet všech bodů a nakonec umístění ve finále.
        </p>
        <p>Body podle tabulky Světového poháru FIS: 1. místo 100, 2. místo 80, 3. místo 60 … od 30. místa po 1 bodu. Pomlčka v závodě znamená, že závodník nestartoval; pomlčka místo pořadí, že zatím nejel žádný závod na sněhu.</p>
      </div>
    </section>
  );
}

/** Výsledky a pořadí /vysledky (Vysledky.dc.html, MobilVysledky.dc.html). */
export default function Results() {
  const calendar = useRaceCalendar();
  const seasons = seasonsOf(calendar.races);
  const [chosen, setChosen] = useState(null);
  const current = getCurrentSeasonId();
  const seasonId = chosen ?? (seasons.includes(current) || seasons.length === 0 ? current : seasons[0]);
  const { standings, status, reload } = useStandings(seasonId);
  const today = startOfToday();
  const pastRaces = calendar.races
    .filter((race) => raceSeasonId(race) === seasonId && raceDate(race) && raceDate(race) < today)
    .sort((a, b) => raceDate(b) - raceDate(a));
  const previousSeason = seasons.find((id) => id < seasonId);
  const oldest = seasons[seasons.length - 1];

  let content;
  if (status === 'loading') content = <LoadingState label="Načítám pořadí poháru…" />;
  else if (status === 'error') {
    content = (
      <Alert type="danger" title="Pořadí se nepodařilo načíst"
        actions={<Button variant="primary" icon="refresh" onClick={reload}>Zkusit znovu</Button>}>
        Server neodpověděl. Zkuste to prosím za chvíli znovu.
      </Alert>
    );
  } else if (!standings || standings.categories.length === 0) {
    content = (
      <EmptyState
        size="lg"
        icon="trophy"
        title={`V sezóně ${formatSeasonShort(seasonId)} zatím pořadí není`}
        hint="Pořadí poháru se počítá z výsledků odjetých závodů. Objeví se tu po prvním závodě, který má výsledky z časomíry."
        action={previousSeason
          ? <Button variant="primary" onClick={() => setChosen(previousSeason)}>Pořadí sezóny {formatSeasonShort(previousSeason)}</Button>
          : <ButtonLink to="/zavody" variant="primary" iconEnd="arrow-right">Kalendář závodů</ButtonLink>}
      />
    );
  } else {
    content = <Standings standings={standings} />;
  }

  return (
    <Screen>
      <Container className={styles.page}>
        <PageHeader
          eyebrow={standings && status === 'ready' ? standingsEyebrow(standings) : `Sezóna ${formatSeasonShort(seasonId)}`}
          title="Výsledky a pořadí"
          description={oldest ? `Záznamy máme od ${toRoman(seasonEdition(oldest))}. ročníku (${formatSeasonShort(oldest)}), pohár se jezdí od roku 2006.` : undefined}
          actions={(
            <>
              {seasons.length > 0 && (
                <Field label="Sezóna" className={styles.season}>
                  <Select value={seasonId} onChange={(event) => setChosen(Number(event.target.value))}>
                    {seasons.map((id) => <option key={id} value={id}>{seasonLabel(id)}</option>)}
                  </Select>
                </Field>
              )}
              {standings?.document && (
                <ButtonLink href={`${API_BASE}${standings.document.url}`} target="_blank" rel="noopener noreferrer" variant="primary" icon="download">
                  {standings.document.final ? 'Celkové výsledky (PDF)' : 'Průběžné pořadí (PDF)'}
                </ButtonLink>
              )}
            </>
          )}
        />
        {content}
        <SeasonRaces races={pastRaces} />
      </Container>
    </Screen>
  );
}
