import { Link } from 'react-router-dom';
import {
  Alert, Badge, BibDate, Button, ButtonLink, DataRow, EmptyState, LoadingState, Panel, Paska,
} from '../../../ms/index.js';
import { fixEncoding } from '../../../../utils/text.js';
import { REGISTRATION_STATE, registrationState } from '../../../../utils/races.js';
import { cx } from '../../../ms/cx.js';
import styles from './SeasonRaces.module.css';

const API_BASE = import.meta.env.VITE_API_BASE || '';

/** Akce řádku: přihláška u otevřeného závodu, výsledky u odjetého (jsou-li). */
function RaceAction({ race, state }) {
  if (state === 'open') {
    return <ButtonLink to={`/zavod/${race.id}#prihlaska`} variant="primary" size="sm">Přihlásit</ButtonLink>;
  }
  if (state === 'past' && race.results_file_id) {
    return (
      <ButtonLink href={`${API_BASE}/races/${race.id}/results`} target="_blank" rel="noopener noreferrer" size="sm" icon="download">
        Výsledky
      </ButtonLink>
    );
  }
  return null;
}

/**
 * Závody sezóny v úzkém sloupci úvodu: datum jako startovní číslo, název,
 * stav slovem a jediná akce (přihlásit / výsledky). Lišta řádku kopíruje stav.
 * races = { status, list (seřazený podle data), load }.
 */
export default function SeasonRaces({ races, today, className }) {
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
      <Panel as="ul" padding="none" className={styles.list}>
        {races.list.map((race) => {
          const state = registrationState(race, today);
          const status = REGISTRATION_STATE[state];
          return (
            <DataRow
              key={race.id}
              as="li"
              tone={status.bar}
              className={styles.row}
              lead={<BibDate date={race.datum} variant="row" />}
              title={<Link to={`/zavod/${race.id}`} className={styles.raceLink}>{fixEncoding(race.areal_name)}</Link>}
              meta={(
                <span className={styles.status}>
                  <Badge tone={status.badge} size="sm">{status.label}</Badge>
                  <RaceAction race={race} state={state} />
                </span>
              )}
            />
          );
        })}
      </Panel>
    );
  }
  return (
    <section className={cx(styles.section, className)} aria-labelledby="zavody-sezony">
      <Paska id="zavody-sezony" aside={<Link to="/zavody" className={styles.more}>Celý kalendář →</Link>}>Závody sezóny</Paska>
      {content}
    </section>
  );
}
