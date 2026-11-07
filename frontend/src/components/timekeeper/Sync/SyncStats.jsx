import { Button, Tooltip } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import styles from './SyncStats.module.css';

/**
 * Počty fronty (TkSynchronizace): ve frontě, odesílá se, chyby, konflikty,
 * neodesláno – a vedle Odeslat teď.
 */
export default function SyncStats({ stats, conflictCount, busy, onSyncNow }) {
  const cards = [
    {
      key: 'pending',
      label: 'Ve frontě',
      value: stats.pending,
      tone: stats.pending > 0 ? 'amber' : 'navy',
    },
    { key: 'processing', label: 'Odesílá se', value: stats.processing, tone: 'navy' },
    {
      key: 'failed',
      label: 'Chyby',
      value: stats.failed,
      tone: stats.failed > 0 ? 'amber' : 'navy',
    },
    {
      key: 'conflict',
      label: 'Konflikty',
      value: conflictCount,
      tone: conflictCount > 0 ? 'amber' : 'navy',
    },
    {
      key: 'dead',
      label: 'Neodesláno',
      value: stats.dead || 0,
      tone: stats.dead > 0 ? 'danger' : 'navy',
    },
  ];

  return (
    <div className={styles.stats}>
      <ul className={styles.cards}>
        {cards.map((card) => (
          <li key={card.key} className={cx(styles.card, styles[card.tone])}>
            <span className={styles.label}>{card.label}</span>
            <span className={styles.value}>{card.value}</span>
          </li>
        ))}
      </ul>
      <div className={styles.send}>
        <Tooltip text="Fronta se odesílá i sama">
          <Button variant="primary" size="lg" icon="sync" block busy={busy} onClick={onSyncNow}>
            Odeslat teď
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
