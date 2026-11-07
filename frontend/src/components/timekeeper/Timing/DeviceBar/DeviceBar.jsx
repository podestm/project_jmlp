import { Button, SegmentedControl, Switch } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import { deviceChip } from '../../frame/statusChips.js';
import styles from './DeviceBar.module.css';

const ROUND_OPTIONS = [
  { value: '1', label: 'Kolo 1' },
  { value: '2', label: 'Kolo 2' },
];

/**
 * Lepivá lišta časomíry na zadávání časů: stav zařízení slovy, kam jdou nové
 * impulzy (kolo 1/2) a automatický zápis. Při měření se přepínají pořád, proto
 * zůstávají na jeden dotyk i u dlouhé startovky. Připojení (port, rychlost,
 * připojit/odpojit) se mění zřídka – otevře se klepnutím na stav časomíry.
 *
 * @param {object} serial celá relace z useSerialSession()
 * @param {() => void} onOpenDevice otevře dialog připojení
 */
export default function DeviceBar({
  serial,
  bridgeTargetRound,
  setBridgeTargetRound,
  autoWrite,
  onAutoWriteChange,
  onOpenDevice,
  className,
}) {
  const chip = deviceChip(serial);

  return (
    <section className={cx(styles.bar, className)} aria-label="Časomíra">
      <div className={cx(styles.group, styles.deviceGroup)}>
        <span className={styles.caps}>Časomíra</span>
        <Button
          size="sm"
          variant="quiet"
          iconEnd="gear"
          className={styles.device}
          data-tone={chip.tone}
          onClick={onOpenDevice}
          title={serial.status}
          aria-label={`Připojení časomíry: ${chip.value}`}
        >
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.value}>{chip.value}</span>
        </Button>
      </div>

      <div className={styles.group}>
        <span className={styles.caps}>Impulzy do</span>
        <SegmentedControl
          label="Cílové kolo nových impulzů"
          size="sm"
          options={ROUND_OPTIONS}
          value={bridgeTargetRound}
          onChange={setBridgeTargetRound}
        />
      </div>

      <Switch
        className={styles.auto}
        label="Zapisovat automaticky"
        checked={autoWrite}
        onChange={(e) => onAutoWriteChange(e.target.checked)}
      />
    </section>
  );
}
