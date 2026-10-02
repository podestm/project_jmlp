// Web Serial support for the timing device (časomíra).
//
// Both the timing screen (TimingEntry) and the diagnostics screen
// (TimingDeviceSettings) talk to the same hardware, so they must agree on what
// a valid line looks like and on how a port is opened and released. Everything
// that used to be copy-pasted between them lives here.

export const SERIAL_BAUD_KEY = 'timekeeper_serial_baud';

export const BAUD_OPTIONS = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

const ACCEPTED_TYPES = ['TIME', 'DNS', 'DNF', 'DSQ'];

/** True when the browser exposes the Web Serial API at all. */
export const hasWebSerial = () => typeof navigator !== 'undefined' && 'serial' in navigator;

/** Web Serial is a secure-context API - HTTPS or localhost only. */
export const canUseWebSerial = () => typeof location !== 'undefined' && (
  location.protocol === 'https:'
  || location.hostname === 'localhost'
  || location.hostname === '127.0.0.1'
);

/**
 * LIP TIMER (Ver 3.01) - the hardware actually used at the races.
 *
 *   00:03:07 16 213 188.19
 *   │        │  │   └─ measured time in seconds.hundredths
 *   │        │  └───── bib number
 *   │        └──────── line sequence number
 *   └───────────────── device uptime (not a wall clock, ignored)
 *
 * The uptime column is optional. The timing device connected on 2. 10. 2026 sent
 * "11  65  5.16" (sequence, bib, seconds; 19200 baud) and every such line
 * ended up in the inbox as unrecognised.
 *
 * In place of the time the device can send a status: "18 12 DNF". DNS and DSQ
 * are accepted the same way.
 *
 * Apart from those statuses the device emits no event type - a number in the
 * last column is a finish time. Its boot banner ("(c)LIP", "Ver: 3.01 ...",
 * rows of asterisks) must not match.
 */
const LIP_LINE = /^(?:(\d{1,2}:\d{2}:\d{2})\s+)?(\d+)\s+(\d+)\s+(\d+(?:[.,]\d+)?|DNF|DNS|DSQ)$/i;

/**
 * Parse one line coming from the timing device.
 *
 * Accepted forms:
 *   00:03:07 16 213 188.19                      (LIP TIMER, space separated)
 *   16  213  188.19                             (LIP TIMER without uptime)
 *   18  12  DNF                                 (LIP TIMER status instead of time)
 *   TIME;DRES;MM:SS.hh   DNS;DRES   DNF;DRES   DSQ;DRES   (tools/ simulator)
 *   {"type":"TIME","bib":12,"time":"1:02.34"}   (raw JSON passthrough)
 *
 * `time` is returned as a string and may be either "MM:SS.hh" or plain seconds;
 * TimingEntry's parseIncomingTime accepts both.
 *
 * @returns {{type: string, bib: number, time?: string, seq?: number, raw: string, ts: number}|null}
 *   null when the line is not something the timing screen would accept.
 */
export const parseTimingDeviceLine = (line) => {
  const trimmed = String(line || '').trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  const lip = trimmed.match(LIP_LINE);
  if (lip) {
    const [, uptime, seq, bib, value] = lip;
    const status = value.toUpperCase();
    const common = {
      bib: Number(bib),
      seq: Number(seq),
      uptime: uptime ?? null,
      raw: trimmed,
      ts: Date.now() / 1000,
    };
    if (ACCEPTED_TYPES.includes(status)) return { type: status, ...common };
    return { type: 'TIME', time: value.replace(',', '.'), ...common };
  }

  const parts = trimmed.replace(',', '.').split(';').map((item) => item.trim());
  if (parts.length < 2) return null;
  const type = String(parts[0] || '').toUpperCase();
  if (!ACCEPTED_TYPES.includes(type)) return null;
  const bib = Number(parts[1]);
  if (!Number.isFinite(bib)) return null;

  if (type === 'TIME') {
    if (parts.length < 3) return null;
    return { type, bib, time: parts[2], raw: trimmed, ts: Date.now() / 1000 };
  }

  return { type, bib, raw: trimmed, ts: Date.now() / 1000 };
};

/**
 * Turn the `time` field of a parsed line into seconds.
 *
 * Accepts what parseTimingDeviceLine emits: plain seconds ("188.19"),
 * "MM:SS.hh" and "HH:MM:SS.hh". Lives here rather than on the timing screen
 * because the serial session validates a line before it ever reaches the UI.
 *
 * @returns {number|null} null when the value is not a time
 */
export const parseIncomingTime = (raw) => {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const normalized = String(raw).trim().replace(',', '.');
  if (!normalized) return null;
  if (/^\d+(\.\d+)?$/.test(normalized)) {
    const seconds = parseFloat(normalized);
    return Number.isFinite(seconds) ? seconds : null;
  }
  const parts = normalized.split(':');
  if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const sec = parseFloat(parts[1]);
    if (Number.isFinite(minutes) && Number.isFinite(sec)) {
      return (minutes * 60) + sec;
    }
  }
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const sec = parseFloat(parts[2]);
    if (Number.isFinite(hours) && Number.isFinite(minutes) && Number.isFinite(sec)) {
      return (hours * 3600) + (minutes * 60) + sec;
    }
  }
  return null;
};

/** Human label for a port in a picker ("USB VID:1A86 PID:7523" / "Port 2"). */
export const describeSerialPort = (port, index = 0) => {
  const info = port?.getInfo?.() || {};
  if (info.usbVendorId) {
    return `USB VID:${info.usbVendorId.toString(16).toUpperCase()} PID:${(info.usbProductId || 0).toString(16).toUpperCase()}`;
  }
  return `Port ${index + 1}`;
};

/** Stable-ish identity of a port across reloads; null when the OS tells us nothing. */
export const serialPortSignature = (port) => {
  const info = port?.getInfo?.() || {};
  if (info.usbVendorId == null && info.usbProductId == null) return null;
  return `${info.usbVendorId ?? ''}:${info.usbProductId ?? ''}`;
};

/**
 * Close a port, swallowing everything.
 *
 * Used on every teardown path including hotplug unplug, where the hardware is
 * already gone and `close()` is expected to throw. Leaving the port open is
 * what makes a replug unrecoverable without a page reload, so we always try.
 *
 * Note that per the Web Serial spec `close()` REJECTS while `readable.locked`
 * is true, so this alone can never free a locked port - use
 * releaseLockedPortReader() first.
 */
export const closeSerialPortSafely = async (port) => {
  if (!port) return;
  try {
    await port.close();
  } catch {
    // the device may already be gone - nothing to do about it
  }
};

/** Nothing on an unplugged device is allowed to hang a retry for longer. */
const RELEASE_TIMEOUT_MS = 2500;

const withDeadline = (promise, ms) => new Promise((resolve, reject) => {
  const handle = setTimeout(() => reject(new Error('Časový limit vypršel')), ms);
  Promise.resolve(promise).then(
    (value) => { clearTimeout(handle); resolve(value); },
    (error) => { clearTimeout(handle); reject(error); }
  );
});

/**
 * The reader + pipe currently holding `port.readable`, per port.
 *
 * Without this the "force-close and retry" recovery documented below is a lie:
 * once a teardown loses its reader reference (a timed-out drain, a connect that
 * was torn down under it), NOTHING can cancel the pipe, `port.close()` rejects
 * forever because the readable is locked, and the port is dead until the tab is
 * reloaded. Keyed weakly so a port the browser forgets is not retained here.
 */
const activePortReaders = new WeakMap();

/**
 * Cancel whatever still holds `port.readable` and wait for the pipe to drain.
 *
 * @param {SerialPort} port
 * @param {number} [timeoutMs] bounded, because an abruptly unplugged device can
 *   leave `reader.cancel()` / the pipe drain permanently pending.
 * @returns {Promise<boolean>} true when the readable is free afterwards. false
 *   means the caller needs a fresh port object from navigator.serial.getPorts().
 */
export const releaseLockedPortReader = async (port, timeoutMs = RELEASE_TIMEOUT_MS) => {
  if (!port) return true;
  if (!port.readable || !port.readable.locked) return true;

  const handle = activePortReaders.get(port);
  if (!handle) return false;

  try {
    await withDeadline(handle.cancel(), timeoutMs);
  } catch {
    return false;
  }
  return Boolean(port.readable) && !port.readable.locked;
};

/**
 * Open the port for reading (when it is not open already) and start the
 * line-oriented read loop.
 *
 * `port.open()` throws InvalidStateError on an already-open port, so the guard
 * matters: the diagnostics page used to open unconditionally and left the
 * operator unable to reconnect without reloading the tab.
 *
 * @param {SerialPort} port
 * @param {Object} options
 * @param {number} options.baudRate
 * @param {(line: string) => void|Promise<void>} options.onLine - every non-empty line
 * @param {() => void} [options.onClose] - fired once the loop has finished
 * @returns {Promise<{close: (opts?: {closePort?: boolean}) => Promise<void>, done: Promise<void>}>}
 */
export const openSerialReader = async (port, { baudRate = 9600, onLine, onClose } = {}) => {
  if (!port.readable) {
    await port.open({ baudRate: Number(baudRate) || 9600 });
  }

  // A readable that is still locked belongs to a teardown that has not settled.
  // pipeTo() would reject with a confusing TypeError. Try a REAL cancel of the
  // handle we still know about first - port.close() cannot break this lock, so
  // throwing straight away used to leave the operator with a permanently dead
  // port and three identical error messages.
  if (port.readable.locked) {
    const freed = await releaseLockedPortReader(port);
    if (!freed || !port.readable || port.readable.locked) {
      const error = new Error('Port je ještě obsazen předchozím připojením');
      error.name = 'SerialPortBusyError';
      throw error;
    }
  }

  const decoder = new TextDecoderStream();
  const pipePromise = port.readable.pipeTo(decoder.writable);
  const reader = decoder.readable.getReader();
  let closing = false;

  // Published before the read loop starts: a teardown that loses this object
  // (or times out) can still get the lock released through the port itself.
  const releaseHandle = {
    cancel: async () => {
      try {
        await reader.cancel();
      } catch {
        // already released
      }
      try {
        await pipePromise;
      } catch {
        // ignore canceled pipe
      }
    },
  };
  activePortReaders.set(port, releaseHandle);

  const done = (async () => {
    let buffer = '';
    try {
      while (true) {
        const { value, done: finished } = await reader.read();
        if (finished) break;

        buffer += value;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          await onLine?.(line);
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
      // pipeTo() holds the lock on port.readable; the port cannot be closed
      // until this settles. Awaiting it here is what stops the port leaking.
      try {
        await pipePromise;
      } catch {
        // ignore canceled pipe
      }
      if (activePortReaders.get(port) === releaseHandle) {
        activePortReaders.delete(port);
      }
      onClose?.();
    }
  })();

  const close = async ({ closePort = false } = {}) => {
    if (!closing) {
      closing = true;
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
    }
    try {
      await done;
    } catch {
      // ignore
    }
    if (closePort) {
      try {
        await port.close();
      } catch {
        // ignore
      }
    }
  };

  return { close, done };
};
