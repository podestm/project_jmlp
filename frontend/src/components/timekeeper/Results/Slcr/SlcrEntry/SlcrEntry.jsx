import { Button } from '../../../../ms/index.js';
import styles from './SlcrEntry.module.css';

/**
 * Vstup do evidence SLČR v záhlaví Výsledků. Jen online: offline je
 * tlačítko vypnuté a pod ním je napsané proč (title na dotykovém zařízení
 * nikdo neuvidí).
 */
export default function SlcrEntry({ isOnline, onOpen }) {
  return (
    <div className={styles.entry}>
      <Button size="sm" icon="cloud-upload" disabled={!isOnline} onClick={onOpen}>
        Evidence SLČR
      </Button>
      {!isOnline && <span className={styles.note}>Evidence SLČR potřebuje připojení k internetu.</span>}
    </div>
  );
}
