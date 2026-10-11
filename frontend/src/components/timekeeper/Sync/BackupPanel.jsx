import { Button, Icon } from '../../ms/index.js';
import { buttonClassName } from '../../ms/Button/Button.jsx';
import styles from './BackupPanel.module.css';

/**
 * Záloha celé lokální databáze (TkSynchronizace vpravo dole). Import nikdy
 * nic nepřepisuje – co v zařízení už je, zůstane.
 */
export default function BackupPanel({ onExport, onImport }) {
  return (
    <section className={styles.panel} aria-labelledby="zaloha-databaze">
      <h2 id="zaloha-databaze" className={styles.title}>Záloha celé lokální databáze</h2>
      <div className={styles.actions}>
        <Button icon="download" onClick={onExport}>Uložit zálohu</Button>
        <label className={buttonClassName({ className: styles.import })}>
          <Icon name="upload" size={18} />
          <span>Načíst zálohu</span>
          <input type="file" accept="application/json" className={styles.file} onChange={onImport} />
        </label>
      </div>
      <p className={styles.note}>
        Import nikdy nic nepřepisuje. Když soubor není platná záloha, nenačte se nic a řekneme to.
      </p>
    </section>
  );
}
