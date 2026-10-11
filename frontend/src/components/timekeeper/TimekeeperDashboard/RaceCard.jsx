import { Badge, BibDate, Button, Cluster } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import { REGISTRATION_STATE, registrationState } from '../../../utils/races.js';
import { isRaceToday } from './dashboard.js';
import LiveToggle from './LiveToggle.jsx';
import styles from './RaceCard.module.css';

/**
 * Karta nadcházejícího závodu ve výběru (TkVyberZavodu): datum jako
 * startovní číslo, místo a stav, počty a akce. Vybraný závod má zelenou
 * lištu a odznak „Vybráno“.
 */
export default function RaceCard({ race, selected, onSelect, onToggleLive }) {
  const registration = REGISTRATION_STATE[registrationState(race)];
  const tone = selected ? 'open' : 'ice';

  return (
    <article className={cx(styles.card, styles[tone])} aria-label={race.areal_name || 'Neznámé místo'}>
      <div className={styles.head}>
        {race.datum ? <BibDate date={race.datum} variant="list" /> : <span className={styles.noDate}>—</span>}
        <div className={styles.text}>
          <div className={styles.titleRow}>
            <h3 className={styles.title}>{race.areal_name || 'Neznámé místo'}</h3>
            {selected && <Badge tone="open" size="sm" icon="check">Vybráno</Badge>}
          </div>
          <p className={styles.meta}>{race.race_nr || `#${race.id}`}</p>
          <Cluster gap={2}>
            <Badge tone={registration.badge} size="sm">{registration.label}</Badge>
            {isRaceToday(race) && <Badge tone="dry" size="sm">Dnes se měří</Badge>}
          </Cluster>
        </div>
      </div>

      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Přihlášeno</dt>
          <dd>{race.reg_count || 0}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Na startovní listině</dt>
          <dd>{race.start_list_count || 0}</dd>
        </div>
      </dl>

      <Cluster gap={3}>
        <Button variant="primary" iconEnd="arrow-right" onClick={() => onSelect(race.id)}>
          {selected ? 'Otevřít závod' : 'Přepnout na tento závod'}
        </Button>
        <LiveToggle live={race.is_live} onToggle={() => onToggleLive(race.id)} />
      </Cluster>
    </article>
  );
}
