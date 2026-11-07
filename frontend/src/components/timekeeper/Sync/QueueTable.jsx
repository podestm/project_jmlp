import { Button, EmptyState, Icon, Table, TableScroll } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import { MAX_RETRIES } from '../../../offline/syncQueue.js';
import { formatDateTimeShort } from '../../../utils/date.js';
import { describeQueueItem, queueStatus } from './queueView.js';
import styles from './QueueTable.module.css';

/**
 * Fronta změn (TkSynchronizace): co čeká na odeslání, stav slovy, pokusy
 * a ruční „Zkusit znovu“ u zápisu, kterému došly pokusy. Neodeslaný zápis
 * je naměřený čas, který na serveru není – řádek je vidět na první pohled.
 */
export default function QueueTable({ items, busy, onRetry }) {
  if (items.length === 0) {
    return <EmptyState icon="check" title="Fronta je prázdná" />;
  }

  return (
    <TableScroll label="Fronta změn">
      <Table density="compact" className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Zapsáno</th>
            <th scope="col">Co čeká na odeslání</th>
            <th scope="col">Stav</th>
            <th scope="col" data-align="end">Pokusy</th>
            <th scope="col" data-align="end">Akce</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const status = queueStatus(item.status);
            return (
              <tr key={item.id} data-state={item.status === 'dead' ? 'error' : item.status === 'conflict' ? 'warning' : undefined}>
                <td data-numeric className={styles.when}>{formatDateTimeShort(item.created_at)}</td>
                <td>
                  <span className={styles.what}>{describeQueueItem(item)}</span>
                  {item.last_error && <span className={styles.error}>{item.last_error}</span>}
                </td>
                <td>
                  <span className={cx(styles.status, styles[status.tone])}>
                    <Icon name={status.icon} size={14} />
                    {status.text}
                  </span>
                </td>
                <td data-numeric data-align="end">{item.retry_count || 0} / {MAX_RETRIES}</td>
                <td data-align="end">
                  {(item.status === 'dead' || item.status === 'failed') ? (
                    <Button size="sm" disabled={busy} onClick={() => onRetry(item.id)}>Zkusit znovu</Button>
                  ) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </TableScroll>
  );
}
