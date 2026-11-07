import { Badge } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import { isTempEntryId } from '../../../offline/offlineEntries.js';
import styles from './OfflineBadge.module.css';

/**
 * Štítek „offline“ u závodníka přidaného bez signálu (dočasné záporné id,
 * offline/offlineEntries.js). Po synchronizaci řádek dostane serverové id
 * a štítek zmizí sám.
 */
export default function OfflineBadge({ entry, className }) {
  if (!isTempEntryId(entry?.id)) return null;
  return (
    <span
      className={cx(styles.wrap, className)}
      title="Přidán offline – na server se odešle po obnovení připojení"
    >
      <Badge tone="dry" size="sm" icon="wifi-off">
        offline
      </Badge>
    </span>
  );
}
