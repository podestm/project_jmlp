import { Link } from 'react-router-dom';
import { Button, Select, SegmentedControl } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import { BAUD_OPTIONS, describeSerialPort } from '../../../utils/serial.js';
import styles from './DevicePanel.module.css';

const ROUND_OPTIONS = [
  { value: '1', label: 'Kolo 1' },
  { value: '2', label: 'Kolo 2' },
];

/**
 * Připojení časomíry pod zadáváním časů (TkZadavaniCasu vpravo dole):
 * stav slovy, rychlost, port, připojit/odpojit/obnovit, cílové kolo nových
 * impulzů a počty ve schránce. Spojení drží SerialSessionProvider, panel ho
 * jen ovládá – přepnutí obrazovky ani obnovení stránky ho nepřeruší.
 *
 * @param {object} serial celá relace z useSerialSession()
 */
export default function DevicePanel({
  serial,
  bridgeTargetRound,
  setBridgeTargetRound,
  liveInboxCount,
  resolvedInboxCount,
  unassignedInboxCount,
}) {
  const { health } = serial;
  const usable = serial.supported && serial.canUse;
  const portIndex = serial.port ? Math.max(0, serial.knownPorts.indexOf(serial.port)) : -1;

  return (
    <section className={styles.panel} aria-label="Připojení časomíry">
      <div className={styles.row}>
        <span className={cx(styles.dot, serial.connected && styles.dotOn)} aria-hidden="true" />
        <span className={styles.status}>{serial.status}</span>
        {serial.port && <span className={styles.port}>{describeSerialPort(serial.port, portIndex)}</span>}
        <span className={styles.spacer} />
        <label className={styles.caps} htmlFor="tk-baud">Baud</label>
        <Select
          id="tk-baud"
          size="sm"
          className={styles.baud}
          value={serial.baud}
          onChange={(e) => serial.setBaud(e.target.value)}
          disabled={serial.connected}
        >
          {BAUD_OPTIONS.map((b) => <option key={b} value={String(b)}>{b}</option>)}
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
              <option key={index} value={String(index)}>{describeSerialPort(p, index)}</option>
            ))}
          </Select>
        )}
        <Button size="sm" icon="plus" onClick={serial.requestPort} disabled={serial.connected || !usable}>
          Vybrat port
        </Button>
        {serial.connected ? (
          <Button size="sm" onClick={serial.disconnect}>Odpojit</Button>
        ) : (
          <Button size="sm" onClick={() => serial.connect()} disabled={!serial.port || !usable}>Připojit</Button>
        )}
        <Button size="sm" icon="sync" onClick={serial.reconnect} disabled={!usable} title="Vynutí zavření a znovuotevření portu">
          Obnovit
        </Button>
      </div>

      <div className={styles.row}>
        <span className={styles.caps}>Nové impulzy do</span>
        <SegmentedControl
          label="Cílové kolo nových impulzů"
          size="sm"
          options={ROUND_OPTIONS}
          value={bridgeTargetRound}
          onChange={setBridgeTargetRound}
        />
        <ul className={styles.counts}>
          {!serial.supported && <li className={styles.warn}>Web Serial nepodporováno</li>}
          {serial.supported && !serial.canUse && <li className={styles.warn}>Vyžaduje HTTPS/localhost</li>}
          {health.unparsedStreak > 0 && <li className={styles.warn}>Nerozpoznané řádky: {health.unparsedStreak}</li>}
          {health.persistFailures > 0 && <li className={styles.danger}>Neuloženo: {health.persistFailures}</li>}
          <li title="Nepotvrzené, čekající, chybové a varovné řádky">Nevyřízeno: {liveInboxCount}</li>
          <li title="Zapsané na server nebo ručně zamítnuté">Vyřízeno: {resolvedInboxCount}</li>
          {unassignedInboxCount > 0 && (
            <li title="Události zatím nepřiřazené k žádnému závodu">Bez závodu: {unassignedInboxCount}</li>
          )}
        </ul>
      </div>

      <p className={styles.note}>
        <span className={styles.caps}>Formát řádků</span>{' '}
        LIP TIMER posílá řádky typu <code className={styles.code}>11 65 5.16</code> (pořadí, dres, čas)
        nebo <code className={styles.code}>18 12 DNF</code>. Připojení zůstává aktivní i při přepnutí obrazovky
        a po obnovení stránky se obnoví samo. Rychlost a záznam řádků: <Link to="/timekeeper/device">Zařízení</Link>.
      </p>
    </section>
  );
}
