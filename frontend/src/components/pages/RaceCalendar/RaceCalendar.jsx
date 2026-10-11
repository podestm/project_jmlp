import { useMemo, useState } from 'react';
import {
  Alert, Button, ButtonLink, Container, EmptyState, Field, Icon, LoadingState, PageHeader, Screen, SegmentedControl,
  Select, Stack,
} from '../../ms/index.js';
import { formatSeasonShort, getCurrentSeasonId, seasonEdition, toRoman } from '../../../utils/season.js';
import { formatDate } from '../../../utils/date.js';
import { fixEncoding } from '../../../utils/text.js';
import { raceSeasonId, seasonLabel, seasonsOf, startOfToday } from '../../../utils/races.js';
import { useRaceCalendar } from '../../../hooks/useRaceCalendar.js';
import { METHOD_FILTERS, matchesFilter, splitByDate } from './raceCalendar.js';
import RaceRow from './RaceRow.jsx';
import styles from './RaceCalendar.module.css';

const API_BASE = import.meta.env.VITE_API_BASE || '';

/**
 * Tlačítko výsledků sezóny: zveřejněné výsledky jsou odkaz ke stažení
 * (celkové / průběžné), jinak vypnuté tlačítko – skončená sezóna „Celkové“,
 * běžící „Průběžné“.
 */
function SeasonResultsButton({ seasonId, result }) {
  if (result) {
    const label = result.final_results === 1 ? 'Celkové výsledky' : 'Průběžné výsledky';
    return (
      <ButtonLink href={`${API_BASE}/${result.document_file_path}`} target="_blank" rel="noopener noreferrer" size="sm" icon="trophy">
        {label}
      </ButtonLink>
    );
  }
  const label = seasonId < getCurrentSeasonId() ? 'Celkové výsledky' : 'Průběžné výsledky';
  return <Button size="sm" icon="trophy" disabled title={`${label} zatím nejsou k dispozici`}>{label}</Button>;
}

/** Nadpis skupiny „Nadcházející“ / „Odjeté závody“ s linkou do konce řádku. */
function GroupTitle({ id, tone, children }) {
  return (
    <h2 id={id} className={styles.groupTitle} data-tone={tone}>
      <span>{children}</span>
      <span className={styles.groupLine} aria-hidden="true" />
    </h2>
  );
}

/** Kalendář závodů /zavody (Zavody.dc.html, MobilZavody.dc.html). */
export default function RaceCalendar() {
  const { races, seasonResults, status, reload } = useRaceCalendar();
  const [chosenSeason, setChosenSeason] = useState(null);
  const [filter, setFilter] = useState('all');
  const today = startOfToday();

  const seasons = useMemo(() => seasonsOf(races), [races]);
  const seasonId = chosenSeason ?? seasons[0] ?? getCurrentSeasonId();
  const seasonRaces = useMemo(() => races.filter((race) => raceSeasonId(race) === seasonId), [races, seasonId]);

  if (status === 'loading') {
    return <Screen><Container className={styles.page}><LoadingState label="Načítám kalendář závodů…" /></Container></Screen>;
  }

  if (status === 'error') {
    return (
      <Screen>
        <Container className={styles.page}>
          <PageHeader title="Kalendář závodů" />
          <Alert
            type="danger"
            title="Kalendář se nepodařilo načíst"
            actions={<Button variant="primary" icon="refresh" onClick={() => reload()}>Zkusit znovu</Button>}
          >
            Nejspíš vypadlo připojení. Zkuste to prosím za chvíli znovu.
          </Alert>
        </Container>
      </Screen>
    );
  }

  const filtered = seasonRaces.filter((race) => matchesFilter(race, filter));
  const { upcoming, past } = splitByDate(filtered, today);
  const filterOptions = METHOD_FILTERS.map((option) => {
    const count = ` (${seasonRaces.filter((race) => matchesFilter(race, option.value)).length})`;
    return { ...option, label: option.label + count, shortLabel: option.shortLabel && option.shortLabel + count };
  });
  const oldestSeason = seasons[seasons.length - 1];
  const firstUpcoming = upcoming[0];

  return (
    <Screen>
      <Container className={styles.page}>
        <div className={styles.head}>
          <PageHeader eyebrow={`${toRoman(seasonEdition(seasonId))}. ročník · sezóna ${formatSeasonShort(seasonId)}`} title="Kalendář závodů" />
          {seasons.length > 0 && (
            <Field
              label="Sezóna"
              className={styles.season}
              hint={oldestSeason && `Záznamy máme od ${toRoman(seasonEdition(oldestSeason))}. ročníku (${formatSeasonShort(oldestSeason)}).`}
            >
              <Select value={seasonId} onChange={(event) => { setChosenSeason(Number(event.target.value)); setFilter('all'); }}>
                {seasons.map((id) => <option key={id} value={id}>{seasonLabel(id)}</option>)}
              </Select>
            </Field>
          )}
        </div>

        {seasonRaces.length === 0 ? (
          <EmptyState
            size="lg"
            icon="inbox"
            title="V sezóně zatím nejsou vypsané žádné závody"
            hint="Termíny se sem doplní, jakmile je pořadatelé potvrdí."
          />
        ) : (
          <Stack gap={7}>
            <div className={styles.toolbar}>
              <SegmentedControl label="Typ závodu" fill options={filterOptions} value={filter} onChange={setFilter} />
              <SeasonResultsButton seasonId={seasonId} result={seasonResults[seasonId]} />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                size="lg"
                icon={filter === 'snow' ? 'snowflake' : 'tree'}
                title={filter === 'snow'
                  ? `Na sněhu se v sezóně ${formatSeasonShort(seasonId)} nezávodí`
                  : `Suchý závod v sezóně ${formatSeasonShort(seasonId)} není`}
                action={<Button onClick={() => setFilter('all')}>Zobrazit všechny závody</Button>}
              />
            ) : (
              <>
                {upcoming.length > 0 && (
                  <section className={styles.group} aria-labelledby="nadchazejici">
                    <GroupTitle id="nadchazejici" tone="navy">Nadcházející</GroupTitle>
                    <ul className={styles.list}>
                      {upcoming.map((race) => <RaceRow key={race.id} race={race} today={today} />)}
                    </ul>
                  </section>
                )}

                <section className={styles.group} aria-labelledby="odjete">
                  <GroupTitle id="odjete">Odjeté závody</GroupTitle>
                  {past.length > 0 ? (
                    <ul className={styles.list}>
                      {past.map((race) => <RaceRow key={race.id} race={race} today={today} />)}
                    </ul>
                  ) : (
                    <div className={styles.noPast}>
                      <Icon name="calendar" size={30} strokeWidth={1.6} className={styles.noPastIcon} />
                      <div className={styles.noPastText}>
                        <p className={styles.noPastTitle}>V této sezóně se zatím nezávodilo</p>
                        <p className={styles.noPastHint}>
                          {firstUpcoming && `První závod je ${formatDate(firstUpcoming.datum, { day: 'numeric', month: 'long' })} – ${fixEncoding(firstUpcoming.areal_name)}. `}
                          Výsledky se sem doplní hned po něm – starší ročníky najdete přepnutím sezóny.
                        </p>
                      </div>
                      <ButtonLink to="/vysledky">Výsledky a pořadí</ButtonLink>
                    </div>
                  )}
                </section>
              </>
            )}
          </Stack>
        )}
      </Container>
    </Screen>
  );
}
