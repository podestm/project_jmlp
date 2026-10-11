import { BAUD_OPTIONS, describeSerialPort } from '../../utils/serial.js';
import { TK_ACCENT_FILL, TK_ACCENT_TEXT } from './TimekeeperChrome.jsx';
import Icon from '../ms/Icon/Icon.jsx';

/**
 * Stav časomíry a její připojení.
 *
 * Vytaženo z TimingEntry: jsou to samé podmíněné hlášky bez vlastní logiky,
 * a obrazovka zadávání časů díky tomu drží jen to, co skutečně řídí.
 *
 * Hlášky nejsou kosmetika. Když se událost z časomíry nepodaří uložit nebo
 * databázi drží jiná karta, obrazovka dál vypadá funkčně a přitom se nic
 * neukládá - proto se to říká nahlas a doslova.
 *
 * @param {object} serial celá relace z useSerialSession() - předává se vcelku,
 *   aby se sedmnáct hodnot nemuselo přepisovat na sedmnáct propů
 */
export default function SerialStatusBar({
  selectedRaceId,
  hasWriteLock,
  serial,
  bridgeTargetRound,
  setBridgeTargetRound,
  liveInboxCount,
  resolvedInboxCount,
  unassignedInboxCount,
  unparsedStreakAlert,
}) {
  return (
    <>

    {serial.dbStateText && (
      <div className="alert alert-danger py-2 d-flex align-items-center small" role="alert">
        <Icon name="database" className="me-2" />
        {serial.dbStateText}
      </div>
    )}

    {serial.health.persistFailures > 0 && (
      <div className="alert alert-danger py-2 d-flex align-items-center flex-wrap gap-2 small" role="alert">
        <Icon name="error" className="me-1" />
        <span>
          {serial.health.persistFailures} událostí z časomíry se nepodařilo uložit do zařízení
          {serial.health.bufferedEvents > 0
            ? ` – ${serial.health.bufferedEvents} čeká v paměti a bude uloženo po obnovení databáze.`
            : ' – uložily se až při dalším pokusu.'}
          {serial.health.lastPersistError ? ` (${serial.health.lastPersistError})` : ''}
        </span>
        {serial.health.bufferedEvents > 0 && (
          <button type="button" className="btn btn-sm btn-outline-danger py-0 px-2 ms-auto" onClick={serial.retryPersist}>
            Zkusit uložit znovu
          </button>
        )}
      </div>
    )}

    {serial.health.unparsedStreak >= unparsedStreakAlert && (
      <div className="alert alert-warning py-2 small" role="alert">
        <Icon name="question" className="me-2" />
        Časomíra posílá data, ale posledních {serial.health.unparsedStreak} řádků se nepodařilo rozpoznat
        (celkem {serial.health.unparsedTotal}). Zkontrolujte formát výstupu zařízení.
        {serial.health.lastUnparsedLine ? <> Poslední řádek: <code>{serial.health.lastUnparsedLine}</code></> : null}
        {' '}
        Řádky jsou uložené v inboxu, žádný impulz se neztratil.
      </div>
    )}

    {serial.detection && (
      <div className="alert alert-info py-2 d-flex align-items-center flex-wrap gap-2 small" role="status">
        <Icon name="search" className="me-1" />
        <span>
          Hledám rychlost časomíry: {serial.detection.baud} ({serial.detection.index + 1} z {serial.detection.total}).
          Posílejte z časomíry časy (nebo ji vypněte a zapněte), dokud se rychlost nenajde.
        </span>
        <button type="button" className="btn btn-sm btn-outline-danger py-0 px-2 ms-auto" onClick={() => serial.cancelDetection()}>
          Zastavit
        </button>
      </div>
    )}

    {serial.baudHint && !serial.detection && (
      <div className="alert alert-warning py-2 d-flex align-items-center flex-wrap gap-2 small" role="alert">
        <Icon name="warning" className="me-1" />
        <span>
          Časomíra posílá data, kterým aplikace nerozumí – nejspíš vysílá jinou rychlostí než {serial.baud}.
          Rychlost se sama nepřepíná, zjistěte ji tlačítkem.
        </span>
        <button type="button" className="btn btn-sm btn-outline-primary py-0 px-2 ms-auto" onClick={serial.detectBaud}>
          Zjistit rychlost
        </button>
      </div>
    )}

    {serial.heldByOtherTab && (
      <div className="alert alert-info py-2 d-flex align-items-center flex-wrap gap-2 small" role="alert">
        <Icon name="plug" className="me-1" />
        <span>Časomíru má otevřenou jiná karta. Události se ukládají společně a zobrazují se i zde.</span>
        <button type="button" className="btn btn-sm btn-outline-primary py-0 px-2 ms-auto" onClick={serial.reconnect}>
          Převzít časomíru
        </button>
      </div>
    )}

    {!hasWriteLock && selectedRaceId && (
      <div className="alert alert-warning py-2 d-flex align-items-center small" role="alert">
        <Icon name="lock" className="me-2" />
        Tato karta je pouze pro čtení. Editace probíhá v jiné otevřené kartě stejného závodu.
      </div>
    )}

    {selectedRaceId && (
      <div className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
        <div className="card-body py-2 px-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="fw-semibold" style={{ fontSize: '0.85rem', color: TK_ACCENT_TEXT }}>
                <Icon name="plug" className="me-1" />Přímé serial připojení
              </span>
              <select
                className="form-select form-select-sm"
                style={{ width: '110px' }}
                value={serial.baud}
                onChange={(e) => serial.setBaud(e.target.value)}
                disabled={serial.connected}
              >
                {BAUD_OPTIONS.map((b) => (
                  <option key={b} value={String(b)}>{b}</option>
                ))}
              </select>
              {!serial.connected && serial.knownPorts.length > 1 && (
                <select
                  className="form-select form-select-sm"
                  style={{ width: '210px' }}
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
                </select>
              )}
              <button
                className="btn btn-sm btn-outline-dark"
                onClick={serial.requestPort}
                disabled={serial.connected || !serial.supported || !serial.canUse}
              >
                Vybrat port
              </button>
              {serial.connected ? (
                <button className="btn btn-sm btn-outline-danger" onClick={serial.disconnect}>
                  Odpojit
                </button>
              ) : (
                <button
                  className="btn btn-sm btn-outline-dark"
                  onClick={() => serial.connect()}
                  disabled={!serial.port || !serial.supported || !serial.canUse}
                >
                  Připojit
                </button>
              )}
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={serial.reconnect}
                disabled={!serial.supported || !serial.canUse}
                title="Vynutí zavření a znovuotevření portu"
              >
                <Icon name="sync" className="me-1" />Obnovit připojení
              </button>
              <span className={`badge ${serial.connected ? 'bg-success' : 'bg-secondary'}`}>{serial.status}</span>
              {serial.health.unparsedStreak > 0 && (
                <span className="badge bg-warning text-dark">Nerozpoznané řádky: {serial.health.unparsedStreak}</span>
              )}
              {serial.health.persistFailures > 0 && (
                <span className="badge bg-danger">Neuloženo: {serial.health.persistFailures}</span>
              )}
              {!serial.supported && <span className="badge bg-warning text-dark">Web Serial nepodporováno</span>}
              {serial.supported && !serial.canUse && <span className="badge bg-warning text-dark">Vyžaduje HTTPS/localhost</span>}
              {serial.port && <span className="badge text-bg-light border">Port vybrán</span>}
              <span className="badge text-bg-light border" title="Nepotvrzené, čekající, chybové a varovné řádky">
                Nevyřízeno {liveInboxCount}
              </span>
              <span className="badge text-bg-light border" title="Zapsané na server nebo ručně zamítnuté">
                Vyřízeno {resolvedInboxCount}
              </span>
              {unassignedInboxCount > 0 && (
                <span className="badge text-bg-light border" title="Události zatím nepřiřazené k žádnému závodu">
                  Bez závodu {unassignedInboxCount}
                </span>
              )}
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <small className="fw-semibold" style={{ color: TK_ACCENT_TEXT }}>
                <Icon name="corner-down-right" className="me-1" />Cílové kolo:
              </small>
              <div className="btn-group btn-group-sm">
                <button
                  className={`btn py-0 px-2 ${bridgeTargetRound === '1' ? '' : 'btn-outline-dark'}`}
                  style={{
                    fontSize: '0.75rem',
                    ...(bridgeTargetRound === '1' ? { background: TK_ACCENT_FILL, color: 'white', border: 'none' } : {})
                  }}
                  onClick={() => setBridgeTargetRound('1')}
                >
                  Kolo 1
                </button>
                <button
                  className={`btn py-0 px-2 ${bridgeTargetRound === '2' ? '' : 'btn-outline-dark'}`}
                  style={{
                    fontSize: '0.75rem',
                    ...(bridgeTargetRound === '2' ? { background: TK_ACCENT_FILL, color: 'white', border: 'none' } : {})
                  }}
                  onClick={() => setBridgeTargetRound('2')}
                >
                  Kolo 2
                </button>
              </div>
              <small className="text-muted">Nové serial události se zařadí do zvoleného kola.</small>
            </div>
          </div>
          <small className="text-muted d-block mt-2">
            LIP TIMER posílá řádky typu <code>11 65 5.16</code> (pořadí, dres, čas) nebo <code>18 12 DNF</code>.
            Připojení zůstává aktivní i při přepnutí na jinou obrazovku a po obnovení stránky se obnoví samo.
            Rychlost a záznam řádků: Nastavení → Časomíra.
          </small>
        </div>
      </div>
    )}
    </>
  );
}
