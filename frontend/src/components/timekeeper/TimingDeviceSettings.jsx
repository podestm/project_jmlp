import { useEffect, useState } from 'react';
import { useConfirm } from '../../hooks/useConfirm.jsx';
import { BAUD_OPTIONS, describeSerialPort, parseTimingDeviceLine } from '../../utils/serial.js';
import { isCleanDeviceLine } from './baudDetection.js';
import { useSerialSession } from './SerialSessionProvider.jsx';
import { TK_ACCENT } from './TimekeeperChrome.jsx';
import Icon from '../ms/Icon/Icon.jsx';

const LOG_LIMIT = 200;

/**
 * Připojení časomíry: port, rychlost (baud), "Zjistit rychlost" a živý
 * záznam řádků, které časomíra posílá.
 *
 * Port drží jediná relace pro celou časomíru (SerialSessionProvider). Tahle
 * stránka dřív otevírala port sama a narážela na "port is already open",
 * když ho relace už držela - teď jen ovládá tu společnou.
 */
export default function TimingDeviceSettings() {
  const serial = useSerialSession();
  const { confirm, confirmElement } = useConfirm();
  const [log, setLog] = useState([]);

  // Řádky z časomíry, jak přišly - i nečitelné, právě na ty je záznam.
  useEffect(() => serial.subscribeLines((line) => {
    const text = String(line ?? '').trim();
    if (!text) return;
    const mark = parseTimingDeviceLine(text) ? '✓' : (isCleanDeviceLine(text) ? 'i' : '?');
    const time = new Date().toLocaleTimeString('cs-CZ');
    setLog((previous) => [{ mark, text, time }, ...previous].slice(0, LOG_LIMIT));
  }), [serial.subscribeLines]);

  const verified = serial.lockedBaud != null && serial.lockedBaud === String(serial.baud);
  const detecting = serial.detection != null;
  const usable = serial.supported && serial.canUse;

  const startDetection = async () => {
    if (verified) {
      const go = await confirm({
        title: 'Hledat jinou rychlost?',
        message: `Na rychlosti ${serial.baud} už z časomíry přišel platný řádek. Hledejte jen tehdy, když časomíra opravdu posílá nečitelná data.`,
        confirmLabel: 'Hledat rychlost',
        variant: 'primary',
        icon: 'search'
      });
      if (!go) return;
    }
    serial.detectBaud();
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="fw-bold mb-0">
            <Icon name="plug" className="me-2" style={{ color: TK_ACCENT }} />
            Připojení časomíry
          </h5>
          <small className="text-muted">Přímé připojení přes Web Serial (Chrome, Edge). Spojení platí pro celou časomíru.</small>
        </div>
      </div>

      {!serial.supported && (
        <div className="alert alert-warning">
          <Icon name="warning" className="me-2" />
          Tento prohlížeč nepodporuje Web Serial. Použijte Google Chrome nebo Microsoft Edge.
        </div>
      )}
      {serial.supported && !serial.canUse && (
        <div className="alert alert-warning">
          <Icon name="shield-lock" className="me-2" />
          Web Serial funguje jen na HTTPS nebo localhost.
        </div>
      )}

      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '12px' }}>
        <div className="card-header bg-white py-2 px-3" style={{ borderBottom: `2px solid ${TK_ACCENT}` }}>
          <small className="fw-bold"><Icon name="plug" className="me-1" style={{ color: TK_ACCENT }} />Port</small>
        </div>
        <div className="card-body p-3">
          <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
            {serial.knownPorts.length > 1 && !serial.connected && (
              <select
                className="form-select form-select-sm"
                style={{ width: '230px' }}
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
              </select>
            )}
            <button className="btn btn-sm btn-outline-dark" onClick={serial.requestPort} disabled={!usable || serial.connected || detecting}>
              <Icon name="plus-circle" className="me-1" />Vybrat port
            </button>
            {serial.connected ? (
              <button className="btn btn-sm btn-outline-danger" onClick={serial.disconnect}>Odpojit</button>
            ) : (
              <button className="btn btn-sm btn-dark" onClick={() => serial.connect()} disabled={!usable || !serial.port || detecting}>
                Připojit
              </button>
            )}
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={serial.reconnect}
              disabled={!usable}
              title="Vynutí zavření a znovuotevření portu"
            >
              <Icon name="sync" className="me-1" />Obnovit připojení
            </button>
            <span className={`badge ${serial.connected ? 'bg-success' : 'bg-secondary'}`}>{serial.status}</span>
          </div>
          {serial.port && (
            <small className="text-muted">Port: {describeSerialPort(serial.port, Math.max(0, serial.knownPorts.indexOf(serial.port)))}</small>
          )}
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '12px' }}>
        <div className="card-header bg-white py-2 px-3" style={{ borderBottom: `2px solid ${TK_ACCENT}` }}>
          <small className="fw-bold"><Icon name="dashboard" className="me-1" style={{ color: TK_ACCENT }} />Rychlost přenosu (baud)</small>
        </div>
        <div className="card-body p-3">
          <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
            <select
              className="form-select form-select-sm"
              style={{ width: '120px' }}
              value={serial.baud}
              onChange={(e) => serial.setBaud(e.target.value)}
              disabled={serial.connected || detecting}
              title={serial.connected ? 'Rychlost změníte po odpojení' : undefined}
            >
              {BAUD_OPTIONS.map((value) => (
                <option key={value} value={String(value)}>{value}</option>
              ))}
            </select>
            {verified ? (
              <span className="badge bg-success-subtle text-success-emphasis border border-success-subtle">
                <Icon name="success" className="me-1" />Ověřená – z časomíry na ní přišel platný řádek
              </span>
            ) : (
              <span className="badge text-bg-light border">Zatím neověřená</span>
            )}
            {detecting ? (
              <button className="btn btn-sm btn-outline-danger" onClick={() => serial.cancelDetection()}>
                <Icon name="stop" className="me-1" />Zastavit hledání
              </button>
            ) : (
              <button className="btn btn-sm btn-outline-primary" onClick={startDetection} disabled={!usable}>
                <Icon name="search" className="me-1" />Zjistit rychlost
              </button>
            )}
          </div>

          {serial.baudHint && !detecting && (
            <div className="alert alert-warning py-2 small mb-2">
              <Icon name="warning" className="me-2" />
              Časomíra posílá data, kterým aplikace nerozumí – nejspíš vysílá jinou rychlostí než {serial.baud}.
              Klikněte na „Zjistit rychlost“.
            </div>
          )}

          {detecting ? (
            <div className="alert alert-info py-2 small mb-0">
              <div className="fw-semibold mb-1">
                Zkouším {serial.detection.baud} baudů ({serial.detection.index + 1} z {serial.detection.total})
              </div>
              Posílejte z časomíry časy (nebo ji vypněte a zapněte), dokud se rychlost nenajde.
              Na každé rychlosti se poslouchá několik sekund; čitelný řádek hledání ukončí a rychlost se uloží.
              <div className="progress mt-2" style={{ height: '6px' }}>
                <div
                  className="progress-bar"
                  style={{ width: `${((serial.detection.index + 1) / serial.detection.total) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <small className="text-muted d-block">
              Rychlost se nikdy nepřepíná sama – jedna chyba přenosu může být šum na kabelu. LIP TIMER na závodech vysílá 19200.
            </small>
          )}
        </div>
      </div>

      <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
        <div className="card-header bg-white py-2 px-3 d-flex justify-content-between align-items-center" style={{ borderBottom: `2px solid ${TK_ACCENT}` }}>
          <small className="fw-bold"><Icon name="terminal" className="me-1" style={{ color: TK_ACCENT }} />Živý záznam z časomíry</small>
          {log.length > 0 && (
            <button className="btn btn-sm btn-link py-0" onClick={() => setLog([])}>Vymazat záznam</button>
          )}
        </div>
        <div className="card-body p-3">
          <div
            className="rounded p-2"
            style={{ background: '#1a1a2e', color: '#e5e7eb', fontFamily: 'monospace', fontSize: '0.78rem', minHeight: '96px', maxHeight: '320px', overflowY: 'auto' }}
          >
            {log.length === 0 ? (
              <span style={{ color: 'rgba(255,255,255,0.72)' }}>Čekám na data z časomíry…</span>
            ) : (
              log.map((entry, index) => (
                <div key={index} style={{ color: entry.mark === '✓' ? '#86efac' : (entry.mark === 'i' ? '#93c5fd' : '#fca5a5') }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{entry.time}</span> {entry.mark} {entry.text}
                </div>
              ))
            )}
          </div>
          <div className="form-text">
            ✓ čas nebo stav (např. <code>11 65 5.16</code>, <code>00:03:07 16 213 188.19</code>, <code>18 12 DNF</code>),
            {' '}i hlášení časomíry, ? nerozpoznaný řádek. Časy se zapisují na obrazovce Časy.
          </div>
        </div>
      </div>
      {confirmElement}
    </div>
  );
}
