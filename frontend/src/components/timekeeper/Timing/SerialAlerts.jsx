import { Alert, Button } from '../../ms/index.js';
import styles from './SerialAlerts.module.css';

/**
 * Hlášky časomíry nad tabulkou zadávání časů (TkZadavaniCasu „Další stavy“).
 *
 * Nejsou kosmetika: když se událost z časomíry nepodaří uložit nebo databázi
 * drží jiná karta, obrazovka dál vypadá funkčně a přitom se nic neukládá –
 * proto se to říká nahlas a doslova. Hledání rychlosti a výstraha o rychlosti
 * nejsou nikdy vidět zároveň.
 *
 * @param {object} serial celá relace z useSerialSession()
 * @param {() => void} onTakeOver převzetí časomíry od jiné karty (s potvrzením)
 */
export default function SerialAlerts({ serial, selectedRaceId, hasWriteLock, unparsedStreakAlert, onTakeOver }) {
  const { health } = serial;
  return (
    <div className={styles.alerts}>
      {!serial.supported && selectedRaceId && (
        <Alert type="info" compact title="Časomíra na USB v tomto prohlížeči nefunguje">
          Prohlížeč neumí číst sériový port, takže impulzy z časomíry sem nedorazí. Čas opište z displeje
          časomíry nebo z papíru a zadejte ho ručně.
        </Alert>
      )}

      {serial.dbStateText && (
        <Alert type="danger" compact title="Lokální databáze je zavřená – naměřené časy se NEUKLÁDAJÍ">
          {serial.dbStateText}
        </Alert>
      )}

      {health.persistFailures > 0 && (
        <Alert
          type="danger"
          compact
          title={`${health.persistFailures} událostí z časomíry se nepodařilo uložit do zařízení`}
          actions={health.bufferedEvents > 0 && (
            <Button size="sm" variant="danger" onClick={serial.retryPersist}>Zkusit uložit znovu</Button>
          )}
        >
          {health.bufferedEvents > 0
            ? `${health.bufferedEvents} čeká v paměti a bude uloženo po obnovení databáze.`
            : 'Uložily se až při dalším pokusu.'}
          {health.lastPersistError ? ` Poslední chyba: ${health.lastPersistError}` : ''}
        </Alert>
      )}

      {health.unparsedStreak >= unparsedStreakAlert && (
        <Alert type="warning" compact title={`${health.unparsedStreak} řádky po sobě se nepodařilo rozpoznat`}>
          Časomíra posílá data, ale posledních {health.unparsedStreak} řádků se nepodařilo rozpoznat
          (celkem {health.unparsedTotal}). Zkontrolujte formát výstupu zařízení.
          {health.lastUnparsedLine ? <> Poslední řádek: <code className={styles.code}>{health.lastUnparsedLine}</code></> : null}
          {' '}Řádky jsou uložené ve schránce, žádný impulz se neztratil.
        </Alert>
      )}

      {serial.detection && (
        <Alert
          type="info"
          compact
          actions={<Button size="sm" onClick={() => serial.cancelDetection()}>Zastavit</Button>}
        >
          Hledám rychlost časomíry: <span className={styles.mono}>{serial.detection.baud}</span>
          {' '}({serial.detection.index + 1} z {serial.detection.total}).
          Posílejte z časomíry časy (nebo ji vypněte a zapněte), dokud se rychlost nenajde.
        </Alert>
      )}

      {serial.baudHint && !serial.detection && (
        <Alert
          type="warning"
          compact
          actions={<Button size="sm" icon="search" onClick={serial.detectBaud}>Zjistit rychlost</Button>}
        >
          Časomíra posílá data, kterým aplikace nerozumí – nejspíš vysílá jinou rychlostí
          než <span className={styles.mono}>{serial.baud}</span>. Rychlost se sama nepřepíná, zjistěte ji tlačítkem.
        </Alert>
      )}

      {serial.heldByOtherTab && (
        <Alert
          type="info"
          compact
          title="Časomíru obsluhuje jiná karta"
          actions={<Button size="sm" icon="plug" onClick={onTakeOver}>Převzít časomíru</Button>}
        >
          Události se ukládají společně a zobrazují se i zde.
        </Alert>
      )}

      {!hasWriteLock && selectedRaceId && (
        <Alert type="warning" compact title="Zápis časů drží jiná karta">
          Tato karta je pouze pro čtení. Editace probíhá v jiné otevřené kartě stejného závodu.
        </Alert>
      )}
    </div>
  );
}
