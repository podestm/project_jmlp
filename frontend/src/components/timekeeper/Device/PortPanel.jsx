import { Button, Icon, Select } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import { describeSerialPort } from '../../../utils/serial.js';
import styles from './PortPanel.module.css';

/**
 * Port časomíry (TkZarizeni, TkZarizeniStavy): stav slovy v barevném poli
 * (zelené = připojeno nebo hledá rychlost), výběr povoleného portu, Vybrat
 * port, Připojit/Odpojit a Obnovit připojení.
 */
export default function PortPanel({ serial, usable, detecting }) {
  const portLabel = serial.port
    ? describeSerialPort(serial.port, Math.max(0, serial.knownPorts.indexOf(serial.port)))
    : null;
  const active = serial.connected || detecting;
  const title = detecting
    ? `Hledám rychlost: ${serial.detection.baud} (${serial.detection.index + 1}/${serial.detection.total})`
    : serial.status;

  return (
    <div className={styles.port}>
      <div className={cx(styles.state, active && styles.active)} role="status">
        <Icon name={detecting ? 'search' : serial.connected ? 'plug' : 'plug-off'} size={22} />
        <span>
          <span className={styles.title}>{title}</span>
          {portLabel && <span className={styles.detail}>Port: <span className={styles.mono}>{portLabel}</span></span>}
        </span>
      </div>

      {serial.knownPorts.length > 1 && !serial.connected && (
        <label className={styles.field}>
          <span className={styles.caps}>Povolené porty ({serial.knownPorts.length})</span>
          <Select
            size="sm"
            value={String(serial.knownPorts.indexOf(serial.port))}
            onChange={(e) => {
              const index = Number(e.target.value);
              serial.selectPort(index >= 0 ? serial.knownPorts[index] : null);
            }}
          >
            <option value="-1">-- Vyberte port --</option>
            {serial.knownPorts.map((item, index) => (
              <option key={index} value={String(index)}>{describeSerialPort(item, index)}</option>
            ))}
          </Select>
        </label>
      )}

      <div className={styles.actions}>
        <Button icon="plus" onClick={serial.requestPort} disabled={!usable || serial.connected || detecting}>Vybrat port</Button>
        {serial.connected ? (
          <Button onClick={serial.disconnect}>Odpojit</Button>
        ) : (
          <Button onClick={() => serial.connect()} disabled={!usable || !serial.port || detecting}>Připojit</Button>
        )}
        <Button icon="sync" onClick={serial.reconnect} disabled={!usable}>Obnovit připojení</Button>
      </div>
      <p className={styles.note}>Obnovit připojení vynutí zavření a znovuotevření portu.</p>
    </div>
  );
}
