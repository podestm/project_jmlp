import { Badge, BibDate, Button, DataRow } from '../../ms/index.js';
import LiveToggle from './LiveToggle.jsx';
import styles from './PastRaceRow.module.css';

/**
 * Proběhlý závod jako datový řádek – proběhlých je přes sto, karty by
 * výběr zahltily. Stejné akce jako karta: otevřít a živý přenos.
 */
export default function PastRaceRow({ race, selected, onSelect, onToggleLive }) {
  return (
    <DataRow
      as="li"
      tone={selected ? 'open' : 'neutral'}
      statusLabel={selected ? 'Vybraný závod' : undefined}
      lead={
        race.datum ? (
          <BibDate date={race.datum} variant="table" />
        ) : (
          <span className={styles.noDate}>—</span>
        )
      }
      title={race.areal_name || 'Neznámé místo'}
      meta={`${race.race_nr || `#${race.id}`} · přihlášeno ${race.reg_count || 0} · na listině ${race.start_list_count || 0}`}
      aside={
        <div className={styles.actions}>
          {selected && (
            <Badge tone="open" size="sm" icon="check">
              Vybráno
            </Badge>
          )}
          <LiveToggle size="sm" live={race.is_live} onToggle={() => onToggleLive(race.id)} />
          <Button size="sm" iconEnd="arrow-right" onClick={() => onSelect(race.id)}>
            Otevřít
          </Button>
        </div>
      }
    />
  );
}
