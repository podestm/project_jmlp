import { Alert, Button, Icon, Select, Tooltip } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import { BAUD_OPTIONS } from '../../../utils/serial.js';
import styles from './BaudPanel.module.css';

/**
 * Rychlost přenosu (TkZarizeni, TkZarizeniStavy): výběr, ověřeno/neověřeno
 * slovy, Zjistit rychlost / Zastavit hledání a průběh hledání.
 */
export default function BaudPanel({ serial, usable, detecting, verified, onDetect }) {
  return (
    <div className={styles.panel}>
      <span className={styles.caps} id="tk-baud-label">
        Rychlost přenosu (baud)
      </span>
      <div className={styles.row}>
        <Select
          aria-labelledby="tk-baud-label"
          className={styles.select}
          value={serial.baud}
          onChange={(e) => serial.setBaud(e.target.value)}
          disabled={serial.connected || detecting}
        >
          {BAUD_OPTIONS.map((value) => (
            <option key={value} value={String(value)}>
              {value}
            </option>
          ))}
        </Select>
        <span className={cx(styles.badge, verified && styles.verified)}>
          {verified && <Icon name="check" size={16} />}
          {verified ? 'Ověřená' : 'Neověřená'}
        </span>
      </div>

      {detecting ? (
        <Button icon="stop" className={styles.action} onClick={() => serial.cancelDetection()}>
          Zastavit hledání
        </Button>
      ) : (
        <Tooltip text="LIP TIMER vysílá 19200" className={styles.action}>
          <Button
            icon="search"
            variant={serial.baudHint ? 'primary' : 'outline'}
            onClick={onDetect}
            disabled={!usable}
          >
            Zjistit rychlost
          </Button>
        </Tooltip>
      )}

      {serial.baudHint && !detecting && (
        <Alert type="warning" compact>
          Časomíra nejspíš vysílá jinou rychlostí než{' '}
          <span className={styles.mono}>{serial.baud}</span>.
        </Alert>
      )}

      {detecting ? (
        <div className={styles.progressBox}>
          <p className={styles.progressTitle}>
            Zkouším <span className={styles.mono}>{serial.detection.baud}</span> baudů (
            {serial.detection.index + 1} z {serial.detection.total})
          </p>
          <p className={styles.note}>Posílejte z časomíry časy.</p>
          <progress
            className={styles.bar}
            max={serial.detection.total}
            value={serial.detection.index + 1}
            aria-label="Průběh hledání rychlosti"
          />
        </div>
      ) : null}
    </div>
  );
}
