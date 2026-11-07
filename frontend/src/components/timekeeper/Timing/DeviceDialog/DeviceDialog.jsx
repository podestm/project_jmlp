import { Link } from 'react-router-dom';
import { Button, Modal, Select, Tooltip } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import { BAUD_OPTIONS, describeSerialPort } from '../../../../utils/serial.js';
import styles from './DeviceDialog.module.css';

/**
 * Připojení časomíry (dřív panel pod tabulkou zadávání časů, u dlouhé
 * startovky daleko dole): stav slovy, rychlost, port, připojit/odpojit/obnovit
 * a počty ve schránce. Otevírá se z lepivé lišty (DeviceBar). Spojení drží
 * SerialSessionProvider, dialog ho jen ovládá – zavření dialogu, přepnutí
 * obrazovky ani obnovení stránky ho nepřeruší.
 *
 * @param {object} serial celá relace z useSerialSession()
 */
export default function DeviceDialog({
  open,
  onClose,
  serial,
  liveInboxCount,
  resolvedInboxCount,
  unassignedInboxCount,
}) {
  const { health } = serial;
  const usable = serial.supported && serial.canUse;
  const portIndex = serial.port ? Math.max(0, serial.knownPorts.indexOf(serial.port)) : -1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Zařízení"
      title="Připojení časomíry"
      footer={
        <Button variant="primary" data-autofocus onClick={() => onClose('button')}>
          Hotovo
        </Button>
      }
    >
      <div className={styles.body}>
        <div className={styles.row}>
          <span className={cx(styles.dot, serial.connected && styles.dotOn)} aria-hidden="true" />
          <span className={styles.status}>{serial.status}</span>
          {serial.port && (
            <span className={styles.port}>{describeSerialPort(serial.port, portIndex)}</span>
          )}
        </div>

        <div className={styles.row}>
          <label className={styles.caps} htmlFor="tk-baud">
            Baud
          </label>
          <Select
            id="tk-baud"
            size="sm"
            className={styles.baud}
            value={serial.baud}
            onChange={(e) => serial.setBaud(e.target.value)}
            disabled={serial.connected}
          >
            {BAUD_OPTIONS.map((b) => (
              <option key={b} value={String(b)}>
                {b}
              </option>
            ))}
          </Select>
          {!serial.connected && serial.knownPorts.length > 1 && (
            <Select
              size="sm"
              aria-label="Port časomíry"
              value={String(serial.knownPorts.indexOf(serial.port))}
              onChange={(e) => {
                const index = Number(e.target.value);
                serial.selectPort(index >= 0 ? serial.knownPorts[index] : null);
              }}
            >
              <option value="-1">-- Vyberte port --</option>
              {serial.knownPorts.map((p, index) => (
                <option key={index} value={String(index)}>
                  {describeSerialPort(p, index)}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className={styles.row}>
          <Button icon="plus" onClick={serial.requestPort} disabled={serial.connected || !usable}>
            Vybrat port
          </Button>
          {serial.connected ? (
            <Button onClick={serial.disconnect}>Odpojit</Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => serial.connect()}
              disabled={!serial.port || !usable}
            >
              Připojit
            </Button>
          )}
          <Tooltip text="Zavře a znovu otevře port">
            <Button icon="sync" onClick={serial.reconnect} disabled={!usable}>
              Obnovit
            </Button>
          </Tooltip>
        </div>

        <ul className={styles.counts}>
          {!serial.supported && <li className={styles.warn}>Web Serial nepodporováno</li>}
          {serial.supported && !serial.canUse && (
            <li className={styles.warn}>Vyžaduje HTTPS/localhost</li>
          )}
          {health.unparsedStreak > 0 && (
            <li className={styles.warn}>Nerozpoznané řádky: {health.unparsedStreak}</li>
          )}
          {health.persistFailures > 0 && (
            <li className={styles.danger}>Neuloženo: {health.persistFailures}</li>
          )}
          <li title="Nepotvrzené, čekající, chybové a varovné řádky">
            Nevyřízeno: {liveInboxCount}
          </li>
          <li title="Zapsané na server nebo ručně zamítnuté">Vyřízeno: {resolvedInboxCount}</li>
          {unassignedInboxCount > 0 && (
            <li title="Události zatím nepřiřazené k žádnému závodu">
              Bez závodu: {unassignedInboxCount}
            </li>
          )}
        </ul>

        <Link to="/timekeeper/device" className={styles.more}>
          Rychlost a záznam řádků
        </Link>
      </div>
    </Modal>
  );
}
