import { Button, Table } from '../../ms/index.js';
import { formatDateTimeShort } from '../../../utils/date.js';
import { CONFLICT_FIELDS, formatConflictField, localConflictEntry } from './queueView.js';
import styles from './ConflictPanel.module.css';

/** Přepsat server i Nechat server jsou nevratné – fokus (a Enter) dostane Zrušit. */
const FORCE_CONFIRM = {
  title: 'Přepsat záznam na serveru?',
  message: 'Hodnota z tohoto zařízení přepíše tu, kterou mezitím uložil někdo jiný. Zpátky to nejde.',
  confirmLabel: 'Přepsat server',
  danger: true,
  icon: 'upload',
};
const DROP_CONFIRM = {
  title: 'Zahodit hodnotu z tohoto zařízení?',
  message: 'Na serveru zůstane jeho hodnota a vaše změna se smaže z fronty. Zpátky to nejde.',
  confirmLabel: 'Nechat server',
  danger: true,
  icon: 'close',
};

/**
 * Otevřené konflikty (TkSynchronizace vpravo): co je ve frontě a co na
 * serveru vedle sebe a tři volby – vrátit do fronty, přepsat server, nechat
 * server. Dvě nevratné se ještě zeptají.
 */
export default function ConflictPanel({ api, confirm }) {
  const { conflicts, expandedConflictId, serverSnapshotByConflict } = api;

  const resolveConfirmed = async (conflictId, action, options) => {
    if (await confirm(options)) api.resolve(conflictId, action);
  };

  return (
    <section className={styles.panel} aria-labelledby="otevrene-konflikty">
      <h2 id="otevrene-konflikty" className={styles.title}>
        {conflicts.length === 0 ? 'Žádné otevřené konflikty' : `Otevřené konflikty: ${conflicts.length}`}
      </h2>
      {conflicts.length === 0 && (
        <p className={styles.text}>Až se něco nepodaří zapsat, protože záznam mezitím změnil někdo jiný, objeví se to tady.</p>
      )}
      {conflicts.map((conflict) => {
        const detail = conflict.conflict_detail;
        const expanded = expandedConflictId === conflict.id;
        const local = localConflictEntry(conflict) || {};
        const server = serverSnapshotByConflict[conflict.id] || {};
        return (
          <article key={conflict.id} className={styles.conflict}>
            <header className={styles.head}>
              <span className={styles.name}>
                {detail?.entry_id ? `Záznam #${detail.entry_id}` : `${conflict.method} ${conflict.endpoint}`}
              </span>
              <span className={styles.when}>{formatDateTimeShort(conflict.created_at)}</span>
            </header>
            <p className={styles.text}>{conflict.error_message}</p>
            {detail?.code === 'stale_revision' && (
              <p className={styles.small}>
                Moje revize {detail.client_revision || 'n/a'}, server {detail.server_revision || 'n/a'}.
              </p>
            )}
            <Button size="sm" aria-expanded={expanded} onClick={() => api.toggleConflictDetails(conflict)}>
              {expanded ? 'Skrýt srovnání' : 'Srovnat hodnoty'}
            </Button>
            {expanded && (
              <Table density="compact" caption="Co se přepíše při Přepsat server">
                <thead>
                  <tr>
                    <th scope="col">Pole</th>
                    <th scope="col" data-align="end">Moje fronta</th>
                    <th scope="col" data-align="end">Server teď</th>
                  </tr>
                </thead>
                <tbody>
                  {CONFLICT_FIELDS.map(([field, label]) => (
                    <tr key={field}>
                      <td>{label}</td>
                      <td data-numeric data-align="end">{formatConflictField(local[field])}</td>
                      <td data-numeric data-align="end">{server._error ? 'Nelze načíst' : formatConflictField(server[field])}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <div className={styles.actions}>
              <Button size="sm" onClick={() => api.resolve(conflict.id, 'retry')}>Vrátit do fronty</Button>
              <Button size="sm" variant="danger" onClick={() => resolveConfirmed(conflict.id, 'force', FORCE_CONFIRM)}>Přepsat server</Button>
              <Button size="sm" onClick={() => resolveConfirmed(conflict.id, 'drop', DROP_CONFIRM)}>Nechat server</Button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
