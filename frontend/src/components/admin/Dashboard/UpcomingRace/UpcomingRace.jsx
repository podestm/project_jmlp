import { Badge, BibDate, ButtonLink, EmptyState, Panel } from '../../../ms/index.js';
import { daysWord } from '../dashboard.js';
import styles from './UpcomingRace.module.css';

const registrationsText = (count) => {
  if (count === 1) return '1 přihlášený závodník';
  if (count >= 2 && count <= 4) return `${count} přihlášení závodníci`;
  return `${count} přihlášených závodníků`;
};

/**
 * Nejbližší závod (AdminDashboard): datum jako startovní číslo, místo,
 * stav registrace, kolik dní zbývá a odkaz na přihlášky.
 */
export default function UpcomingRace({ race }) {
  if (!race) {
    return (
      <EmptyState icon="calendar" title="Žádný vypsaný závod" hint="V kalendáři teď není žádný budoucí závod." headingLevel={3} />
    );
  }

  return (
    <Panel padding="md" className={styles.card}>
      <div className={styles.head}>
        {race.datum && <BibDate date={race.datum} variant="list" />}
        <span className={styles.title}>
          <span className={styles.name}>{race.areal_name || 'Místo neuvedeno'}</span>
          <span className={styles.nr}>{race.race_nr || `#${race.id}`}</span>
        </span>
      </div>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>Registrace</dt>
          <dd>
            <Badge tone={race.registration ? 'open' : 'closed'} size="sm">
              {race.registration ? 'Otevřená' : 'Uzavřená'}
            </Badge>
          </dd>
        </div>
        {race.days_until !== null && race.days_until !== undefined && (
          <div className={styles.row}>
            <dt>Do závodu</dt>
            <dd className={styles.mono}>{race.days_until} {daysWord(race.days_until)}</dd>
          </div>
        )}
      </dl>
      <ButtonLink to={`/admin/races/${race.id}/registrations`} size="sm" block>
        {registrationsText(race.registration_count)}
      </ButtonLink>
    </Panel>
  );
}
