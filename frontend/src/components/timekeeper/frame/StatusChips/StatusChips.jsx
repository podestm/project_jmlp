import { useSyncStatus } from '../../../../offline/useSyncStatus.js';
import { useSerialSession } from '../../SerialSessionProvider.jsx';
import { cx } from '../../../ms/cx.js';
import StatusChip from '../StatusChip/StatusChip.jsx';
import { connectionChip, deviceChip, queueChip } from '../statusChips.js';
import { useOfflineSince } from './useOfflineSince.js';
import styles from './StatusChips.module.css';

/**
 * Spojení · Fronta · Zařízení. Samostatná komponenta, aby změny fronty
 * a sériového zařízení překreslily jen odznaky, ne celý rámec s obrazovkou.
 * Na desktopu řada, pod 1024 px mřížka tří dlaždic.
 * - onNavigate: klik na odkaz (mobilní menu se po něm zavře)
 */
export default function StatusChips({ onNavigate, className }) {
  const { isOnline, syncState, queueStats } = useSyncStatus();
  const offlineSince = useOfflineSince(isOnline);
  const serial = useSerialSession();

  return (
    <div role="group" aria-label="Stav časomíry" className={cx(styles.chips, className)}>
      <StatusChip chip={connectionChip({ syncState, offlineSince })} />
      <StatusChip chip={queueChip(queueStats)} to="/timekeeper/sync" onClick={onNavigate} />
      <StatusChip chip={deviceChip(serial)} to="/timekeeper/device" onClick={onNavigate} />
    </div>
  );
}
