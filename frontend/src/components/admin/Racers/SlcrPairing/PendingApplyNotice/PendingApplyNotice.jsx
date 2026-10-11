import { Button } from '../../../../ms/index.js';
import styles from './PendingApplyNotice.module.css';

/**
 * Potvrzení bez převzatých údajů: počet potvrzených, u kterých se náš záznam
 * ještě neopravil podle evidence, a tlačítko „Převzít z evidence“.
 */
export default function PendingApplyNotice({ count, busy, onApply }) {
  if (!(count > 0)) return null;
  return (
    <div role="status" className={styles.notice}>
      <span className={styles.text}>
        U <span className={styles.num}>{count}</span> potvrzených závodníků se ještě nepřevzaly údaje z evidence
        (potvrzeno dřív, než potvrzení začalo opravovat záznam).
      </span>
      <Button variant="primary" size="sm" icon="pencil" busy={busy} onClick={onApply}>Převzít z evidence</Button>
    </div>
  );
}
