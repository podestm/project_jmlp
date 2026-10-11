import { Button } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import styles from './SyncStats.module.css';

/**
 * Počty fronty (TkSynchronizace): ve frontě, odesílá se, chyby, konflikty,
 * neodesláno – každý s větou, co znamená – a vedle Odeslat teď.
 */
export default function SyncStats({ stats, conflictCount, isOnline, busy, onSyncNow }) {
  const cards = [
    { key: 'pending', label: 'Ve frontě', value: stats.pending, hint: isOnline ? 'Odejdou při dalším odeslání.' : 'Čekají na signál.', tone: stats.pending > 0 ? 'amber' : 'navy' },
    { key: 'processing', label: 'Odesílá se', value: stats.processing, hint: isOnline ? 'Právě teď.' : 'Offline se nic neodesílá.', tone: 'navy' },
    { key: 'failed', label: 'Chyby', value: stats.failed, hint: stats.failed > 0 ? 'Zkusí se znovu samy.' : 'Žádná chyba odeslání.', tone: stats.failed > 0 ? 'amber' : 'navy' },
    { key: 'conflict', label: 'Konflikty', value: conflictCount, hint: conflictCount > 0 ? 'Rozhodnout musíte vy.' : 'Nic k rozhodnutí.', tone: conflictCount > 0 ? 'amber' : 'navy' },
    { key: 'dead', label: 'Neodesláno', value: stats.dead || 0, hint: stats.dead > 0 ? 'Došly pokusy – zkuste znovu.' : 'Nic nepropadlo.', tone: stats.dead > 0 ? 'danger' : 'navy' },
  ];

  return (
    <div className={styles.stats}>
      <ul className={styles.cards}>
        {cards.map((card) => (
          <li key={card.key} className={cx(styles.card, styles[card.tone])}>
            <span className={styles.label}>{card.label}</span>
            <span className={styles.value}>{card.value}</span>
            <span className={styles.hint}>{card.hint}</span>
          </li>
        ))}
      </ul>
      <div className={styles.send}>
        <Button variant="primary" size="lg" icon="sync" block busy={busy} onClick={onSyncNow}>Odeslat teď</Button>
        <p className={styles.hint}>
          {isOnline ? 'Fronta se odesílá i sama každých pár vteřin.' : 'Teď jste offline – fronta počká na signál a odejde sama.'}
        </p>
      </div>
    </div>
  );
}
