import { Alert, Button, PageHeader, Paska } from '../../ms/index.js';
import { useConfirm } from '../../../hooks/useConfirm.jsx';
import TkPage from '../frame/TkPage/TkPage.jsx';
import TimekeeperMessage from '../TimekeeperMessage.jsx';
import BackupPanel from './BackupPanel.jsx';
import ConflictPanel from './ConflictPanel.jsx';
import QueueTable from './QueueTable.jsx';
import SyncStats from './SyncStats.jsx';
import { useSyncCenter } from './useSyncCenter.js';
import styles from './SyncCenter.module.css';

/**
 * Synchronizace (TkSynchronizace): počty fronty
 * a Odeslat teď, fronta změn, otevřené konflikty a záloha. Data a akce
 * drží useSyncCenter.
 */
export default function SyncCenter() {
  const { confirm, confirmElement } = useConfirm();
  const api = useSyncCenter();
  const { queueStats } = api;

  return (
    <TkPage>
      <PageHeader
        variant="app"
        title="Synchronizace"
        actions={
          <Button size="sm" icon="refresh" onClick={api.loadData}>
            Obnovit přehled
          </Button>
        }
      />

      {api.authExpired && (
        <Alert type="warning" title="Přihlášení vypršelo – fronta stojí, i když jste online">
          Změny čekají v notebooku a odejdou po přihlášení.
        </Alert>
      )}

      <TimekeeperMessage message={api.message} onDismiss={api.clearMessage} />

      <SyncStats
        stats={queueStats}
        conflictCount={api.conflicts.length}
        busy={api.busy}
        onSyncNow={api.syncNow}
      />

      <div className={styles.columns}>
        <section className={styles.queue} aria-labelledby="fronta-zmen">
          <Paska id="fronta-zmen" aside="Od nejnovějšího">
            Fronta změn
          </Paska>
          <QueueTable items={api.queueItems} busy={api.busy} onRetry={api.retryItem} />
        </section>

        <aside className={styles.side}>
          <ConflictPanel api={api} confirm={confirm} />
          <BackupPanel onExport={api.exportBackup} onImport={api.importBackup} />
        </aside>
      </div>

      {confirmElement}
    </TkPage>
  );
}
