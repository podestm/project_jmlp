import { Badge, Button } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import { seasonCounts, seasonRange, seasonState } from '../seasons.js';
import styles from './SeasonCard.module.css';

/**
 * Sezóna v seznamu (AdminSezony): ročník, roky, název, počty, stav slovy
 * a akce. Rozbalená ukáže `children` (dokumenty sezóny). Sezónu se závody
 * smazat nejde – tlačítko je zamčené a říká proč.
 * - compact: řádek archivu (menší, bez lišty)
 */
export default function SeasonCard({ season, currentSeasonId, expanded, compact = false, onToggle, onEdit, onDelete, children }) {
  const state = seasonState(season, currentSeasonId);
  const locked = season.races_count > 0;
  const documentsId = `sezona-${season.id}-dokumenty`;

  return (
    <article className={cx(styles.card, compact && styles.compact, state === 'Aktuální sezóna' && styles.current)} aria-label={`Sezóna ${season.season_label}`}>
      <div className={styles.row}>
        <span className={styles.edition}>
          {!compact && <span className={styles.editionLabel}>Ročník</span>}
          <span className={styles.editionValue}>{season.edition_label || '—'}</span>
        </span>
        <span className={styles.text}>
          <span className={styles.title}>
            <span className={styles.years}>{season.season_label}</span>
            {!compact && <span className={styles.name}>{season.name}</span>}
          </span>
          <span className={styles.meta}>{seasonRange(season.year_start)} · {seasonCounts(season)}</span>
          <span className={styles.badges}>
            {state !== 'Archiv' && <Badge size="sm" tone={state === 'Aktuální sezóna' ? 'open' : 'neutral'}>{state}</Badge>}
            {!season.active && <Badge size="sm" tone="dry">Neaktivní</Badge>}
          </span>
        </span>
        <span className={styles.actions}>
          <Button
            size="sm"
            icon={expanded ? 'chevron-up' : 'paperclip'}
            aria-expanded={expanded}
            aria-controls={documentsId}
            onClick={() => onToggle(season)}
          >
            {expanded ? 'Sbalit' : 'Dokumenty'}
          </Button>
          <Button size="sm" onClick={() => onEdit(season)} aria-label={`Upravit sezónu ${season.season_label}`}>Upravit</Button>
          <Button
            size="sm"
            variant="danger"
            icon="trash"
            disabled={locked}
            title={locked ? 'Sezóna má závody a nelze ji smazat' : undefined}
            aria-label={locked ? `Sezóna ${season.season_label} má závody a nelze ji smazat` : `Smazat sezónu ${season.season_label}`}
            onClick={() => onDelete(season)}
          >
            Smazat
          </Button>
        </span>
      </div>
      {expanded && <div id={documentsId} className={styles.documents}>{children}</div>}
    </article>
  );
}
