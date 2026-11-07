import { Badge, BibDate, Button, ButtonLink, Icon, Switch } from '../../../ms/index.js';
import { raceSubtitle } from '../../shared/raceText.js';
import { registrationsWord } from '../raceList.js';
import styles from './RaceCard.module.css';

/**
 * Závod jako karta (AdminMobilZavody): datum, místo, počet přihlášek,
 * přepínač registrace a tři akce. Lišta vlevo nese stav registrace,
 * který je řečen i textem u přepínače.
 */
export default function RaceCard({ race, onEdit, onToggleRegistration, onDownloadCsv }) {
  const count = race.registrations_count || 0;
  const docs = [race.proposition_file_id && 'propozice', race.results_file_id && 'výsledky'].filter(Boolean);

  return (
    <article className={styles.card} data-open={race.registration || undefined} aria-label={race.areal_name || race.race_nr}>
      <div className={styles.head}>
        {race.datum && <BibDate date={race.datum} variant="table" />}
        <span className={styles.text}>
          <span className={styles.name}>{race.areal_name || '—'}</span>
          <span className={styles.sub}>{raceSubtitle(race)}</span>
          <span className={styles.sub}>
            <span className={styles.mono}>{race.race_nr}</span>
            {' · '}{docs.length > 0 ? `${docs.join(' a ')} nahrané` : 'bez dokumentů'}
          </span>
          {race.is_final && <Badge tone="dry" size="sm">Finále</Badge>}
        </span>
        <span className={styles.count}>
          <span className={styles.number}>{count}</span>
          <span className={styles.countLabel}>{registrationsWord(count)}</span>
        </span>
      </div>

      <div className={styles.body}>
        <Switch
          label={race.registration ? 'Registrace otevřená' : 'Registrace uzavřená'}
          checked={Boolean(race.registration)}
          onChange={() => onToggleRegistration(race.id)}
          className={styles.switch}
        />
        <div className={styles.actions}>
          <ButtonLink to={`/admin/races/${race.id}/registrations`} size="sm">Přihlášky</ButtonLink>
          <Button size="sm" onClick={() => onDownloadCsv(race.id, race.race_nr)}>Export CSV</Button>
          <Button size="sm" onClick={() => onEdit(race)}>Upravit</Button>
        </div>
        {!race.registration && !race.proposition_file_id && (
          <p className={styles.hint}>
            <Icon name="info" size={16} />
            <span>Chybí propozice.</span>
          </p>
        )}
      </div>
    </article>
  );
}
