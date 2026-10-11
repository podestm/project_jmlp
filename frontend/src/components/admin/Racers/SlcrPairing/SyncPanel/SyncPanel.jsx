import { Button, Select } from '../../../../ms/index.js';
import { formatSyncTime, syncProgress } from '../slcrPairing.js';
import styles from './SyncPanel.module.css';

/**
 * Načtení návrhů ze SLČR: rozsah (aktivní / celý registr), tlačítko a vpravo
 * buď průběh běžícího načítání, nebo kdy se naposledy načítalo (i s chybou).
 */
export default function SyncPanel({ scope, onScopeChange, running, ready, job, onSync }) {
  return (
    <section aria-label="Načtení ze SLČR" className={styles.panel}>
      <span className={styles.controls}>
        <Select
          size="sm"
          value={scope}
          onChange={(event) => onScopeChange(event.target.value)}
          disabled={running}
          aria-label="Koho načíst"
        >
          <option value="active">Aktivní závodníci (letos a loni)</option>
          <option value="all">Celý registr</option>
        </Select>
        <Button variant="primary" size="sm" icon="cloud-download" busy={running} disabled={!ready} onClick={onSync}>
          Načíst návrhy ze SLČR
        </Button>
      </span>
      {running && job ? (
        <span className={styles.progress}>
          <span className={styles.text}>
            Načítám z evidence SLČR… <span className={styles.num}>{job.done}</span> z{' '}
            <span className={styles.num}>{job.total || '?'}</span> závodníků
          </span>
          <span
            role="progressbar"
            aria-label="Průběh načítání ze SLČR"
            aria-valuemin={0}
            aria-valuemax={job.total || undefined}
            aria-valuenow={job.total ? job.done : undefined}
            className={styles.track}
            style={{ '--progress': `${syncProgress(job)}%` }}
          >
            <span className={styles.bar} />
          </span>
        </span>
      ) : (
        <span className={styles.text}>
          {job ? (
            <>
              Naposledy načteno <span className={styles.num}>{formatSyncTime(job.finished_at || job.started_at)}</span>
              {job.error && <span className={styles.error}> – chyba: {job.error}</span>}
            </>
          ) : 'Zatím nenačteno. Načtení trvá několik minut.'}
        </span>
      )}
    </section>
  );
}
