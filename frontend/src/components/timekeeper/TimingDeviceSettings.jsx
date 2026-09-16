import { useEffect, useRef, useState } from 'react';
import { TK_ACCENT, TK_ACCENT_TEXT } from './TimekeeperChrome.jsx';

const SERIAL_BAUD_KEY = 'timekeeper_serial_baud';
const BAUD_OPTIONS = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

const hasWebSerial = () => typeof navigator !== 'undefined' && 'serial' in navigator;

export default function TimingDeviceSettings() {
  const [supported, setSupported] = useState(hasWebSerial());
  const [baud, setBaud] = useState(() => localStorage.getItem(SERIAL_BAUD_KEY) || '9600');
  const [ports, setPorts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Odpojeno');
  const [log, setLog] = useState([]);

  const portRef = useRef(null);
  const readerRef = useRef(null);

  const canUseSerial = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  const refreshPorts = async () => {
    if (!supported) return;
    try {
      const list = await navigator.serial.getPorts();
      setPorts(list);
    } catch {
      setPorts([]);
    }
  };

  useEffect(() => {
    setSupported(hasWebSerial());
    if (hasWebSerial()) refreshPorts();
  }, []);

  useEffect(() => {
    localStorage.setItem(SERIAL_BAUD_KEY, baud);
  }, [baud]);

  useEffect(() => () => {
    if (readerRef.current) {
      try {
        readerRef.current.cancel();
      } catch {
        // ignore
      }
      readerRef.current = null;
    }
    if (portRef.current) {
      try {
        portRef.current.close();
      } catch {
        // ignore
      }
      portRef.current = null;
    }
  }, []);

  const requestPort = async () => {
    if (!supported || !canUseSerial) return;
    try {
      const port = await navigator.serial.requestPort();
      setPorts((prev) => [...prev.filter((p) => p !== port), port]);
      setStatus('Port přidán');
    } catch {
      setStatus('Výběr portu zrušen');
    }
  };

  const connect = async (port) => {
    if (!canUseSerial) {
      setStatus('Web Serial vyžaduje HTTPS nebo localhost');
      return;
    }

    try {
      await port.open({ baudRate: Number(baud) || 9600 });
      portRef.current = port;
      setConnected(true);
      setStatus('Připojeno');
      setLog([]);
      await readLoop(port);
    } catch (err) {
      setConnected(false);
      setStatus(`Chyba: ${err?.message || 'nelze otevřít port'}`);
    }
  };

  const disconnect = async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
      }
    } catch {
      // ignore
    }
    try {
      if (portRef.current) {
        await portRef.current.close();
      }
    } catch {
      // ignore
    }
    readerRef.current = null;
    portRef.current = null;
    setConnected(false);
    setStatus('Odpojeno');
  };

  const parseLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    const parts = trimmed.replace(',', '.').split(';').map((p) => p.trim());
    if (parts.length < 2) return null;
    const kind = String(parts[0] || '').toUpperCase();
    if (!['TIME', 'DNS', 'DNF', 'DSQ'].includes(kind)) return null;
    const bib = Number(parts[1]);
    if (!Number.isFinite(bib)) return null;
    if (kind === 'TIME' && parts.length < 3) return null;
    return { kind, bib, time: parts[2] || null, raw: trimmed };
  };

  const readLoop = async (port) => {
    if (!port.readable) return;

    const decoder = new TextDecoderStream();
    const pipePromise = port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();
    readerRef.current = reader;
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = parseLine(line);
          const display = parsed
            ? `✓ ${line.trim()}`
            : `? ${line.trim()}`;
          setLog((prev) => [display, ...prev].slice(0, 50));
        }
      }
    } catch {
      // reader canceled or device disconnected
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
      readerRef.current = null;
      setConnected(false);
      setStatus('Odpojeno');
      try {
        await pipePromise;
      } catch {
        // ignore canceled pipe
      }
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="fw-bold mb-0">
            <i className="bi bi-usb-symbol me-2" style={{ color: TK_ACCENT }}></i>
            Připojení časomíry
          </h5>
          <small className="text-muted">Pouze přímé připojení přes Web Serial API (Edge/Chrome)</small>
        </div>
      </div>

      {!supported && (
        <div className="alert alert-warning">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Tento prohlížeč nepodporuje Web Serial API. Použijte Microsoft Edge nebo Google Chrome.
        </div>
      )}

      {supported && !canUseSerial && (
        <div className="alert alert-warning">
          <i className="bi bi-shield-lock-fill me-2"></i>
          Web Serial funguje pouze na HTTPS nebo localhost.
        </div>
      )}

      <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
        <div className="card-header bg-white py-2 px-3" style={{ borderBottom: '2px solid #e94560' }}>
          <small className="fw-bold"><i className="bi bi-sliders me-1" style={{ color: TK_ACCENT }}></i>Nastavení serial portu</small>
        </div>
        <div className="card-body p-3">
          <div className="row g-3 align-items-end mb-3">
            <div className="col-md-4">
              <label className="form-label small fw-semibold mb-1">Baud rate</label>
              <select className="form-select form-select-sm" value={baud} onChange={(e) => setBaud(e.target.value)}>
                {BAUD_OPTIONS.map((value) => (
                  <option key={value} value={String(value)}>{value}</option>
                ))}
              </select>
            </div>
            <div className="col-md-8 d-flex gap-2">
              <button className="btn btn-sm btn-dark" onClick={requestPort} disabled={!supported || !canUseSerial}>
                <i className="bi bi-plus-circle me-1"></i>Přidat port
              </button>
              <button className="btn btn-sm btn-outline-secondary" onClick={refreshPorts} disabled={!supported}>
                <i className="bi bi-arrow-clockwise"></i>
              </button>
              <span className={`badge d-flex align-items-center ${connected ? 'bg-success' : 'bg-secondary'}`}>{status}</span>
            </div>
          </div>

          <div className="mb-3">
            <div className="fw-semibold small mb-2" style={{ color: TK_ACCENT_TEXT }}>Dostupné porty</div>
            {ports.length === 0 ? (
              <div className="text-muted small">Žádný port zatím nebyl povolen. Klikněte Přidat port.</div>
            ) : (
              <div className="list-group list-group-flush">
                {ports.map((port, i) => {
                  const info = port.getInfo?.() || {};
                  const label = info.usbVendorId
                    ? `USB VID:${info.usbVendorId.toString(16).toUpperCase()} PID:${(info.usbProductId || 0).toString(16).toUpperCase()}`
                    : `Port ${i + 1}`;
                  const isActive = connected && portRef.current === port;

                  return (
                    <div key={i} className="list-group-item border rounded mb-1 d-flex justify-content-between align-items-center py-2">
                      <small><i className="bi bi-usb-drive me-2 text-muted"></i>{label}</small>
                      {isActive ? (
                        <button className="btn btn-sm btn-danger py-0 px-2" onClick={disconnect}>Odpojit</button>
                      ) : (
                        <button className="btn btn-sm btn-dark py-0 px-2" onClick={() => connect(port)}>Připojit</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="fw-semibold small mb-1" style={{ color: TK_ACCENT_TEXT }}>Živý log</div>
            <div className="rounded p-2" style={{ background: '#1a1a2e', color: '#86efac', fontFamily: 'monospace', fontSize: '0.78rem', minHeight: '96px', maxHeight: '180px', overflowY: 'auto' }}>
              {log.length === 0 ? (
                <span className="text-white-50">Čeká na data ze sériového portu...</span>
              ) : (
                log.map((line, idx) => <div key={idx}>{line}</div>)
              )}
            </div>
            <div className="form-text">Formát: TIME;DRES;MM:SS.hh | DNS;DRES | DNF;DRES | DSQ;DRES</div>
          </div>
        </div>
      </div>
    </div>
  );
}
