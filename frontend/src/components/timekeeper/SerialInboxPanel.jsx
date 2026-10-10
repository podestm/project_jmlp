import BridgeEventRow from './BridgeEventRow.jsx';
import { EMPTY_RESOLUTION } from './inboxMatching.js';
import { TK_ACCENT_TEXT } from './TimekeeperChrome.jsx';
import { INBOX_RENDER_LIMIT } from './useInboxEvents.js';

/**
 * Schránka impulzů z časomíry.
 *
 * Čistě zobrazovací - události drží IndexedDB a komu se čas zapíše, rozhoduje
 * `resolveInboxEvent`. Sem chodí už hotové výsledky, aby řádek nemohl ukázat
 * jednoho závodníka a potvrzení zapsat jinému.
 *
 * @param {Array}  events            všechny uložené události závodu
 * @param {Array}  visibleEvents     ty, které se opravdu vykreslí
 * @param {number} hiddenCount       kolik jich je skrytých (jen vyřízené)
 * @param {boolean} showAll          vykreslují se všechny uložené události
 * @param {function} onShowAllChange přepne mezi posledními a všemi
 * @param {Map}    resolutions       id události -> {entry, count, index, excluded}
 * @param {number} unparsedCount     nerozpoznané řádky ze zařízení
 * @param {number} resolvedCount     vyřízené řádky (potvrzené / zamítnuté / chybové)
 * @param {boolean} autoWrite        zapisovat jednoznačné události bez potvrzení
 * @param {function} onAutoWriteChange přepne automatický zápis
 * @param {function} onRejectAuto    "Zamítnout" u automaticky zapsané události
 */
export default function SerialInboxPanel({
  events,
  visibleEvents,
  hiddenCount,
  showAll,
  onShowAllChange,
  resolutions,
  targetRound,
  unparsedCount,
  resolvedCount,
  onCycle,
  onConfirm,
  onReject,
  onRejectAuto,
  autoWrite = false,
  onAutoWriteChange,
  onDismissUnparsed,
  onClearResolved,
  onClearAll,
}) {
  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: '10px' }}>
      <div className="card-body p-0">
        <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom flex-wrap gap-2">
          <div>
            <div className="fw-semibold" style={{ color: TK_ACCENT_TEXT, fontSize: '0.95rem' }}>
              <i className="bi bi-journal-text me-1"></i>Serial inbox
            </div>
            <small className="text-muted">
              Klik na badge přepne kandidáta, potvrzení zapíše serial událost do výsledků.
              {autoWrite ? ' Jednoznačné události do prázdného kola se zapisují automaticky.' : ''}
              {' '}Uložené události zůstávají až do ručního smazání.
            </small>
          </div>
          <div className="d-flex align-items-center gap-1 flex-wrap">
            <div
              className="form-check form-switch mb-0 me-1"
              title="Událost s jediným kandidátem se zapíše do prázdného kola bez potvrzení. Obsazené kolo a ostatní výjimky zůstávají ruční."
            >
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="tk-bridge-auto-write"
                checked={autoWrite}
                onChange={(e) => onAutoWriteChange?.(e.target.checked)}
              />
              <label className="form-check-label small" htmlFor="tk-bridge-auto-write">
                Zapisovat automaticky
              </label>
            </div>
            <span className="badge bg-dark">Kolo {targetRound}</span>
            {unparsedCount > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-outline-warning py-0 px-2"
                style={{ fontSize: '0.72rem' }}
                onClick={onDismissUnparsed}
                title="Označí nerozpoznané řádky jako zamítnuté"
              >
                <i className="bi bi-question-octagon me-1"></i>Odbavit nerozpoznané ({unparsedCount})
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary py-0 px-2"
              style={{ fontSize: '0.72rem' }}
              onClick={onClearResolved}
              disabled={resolvedCount === 0}
              title="Smaže potvrzené, zamítnuté a chybové řádky"
            >
              <i className="bi bi-eraser me-1"></i>Smazat vyřízené
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger py-0 px-2"
              style={{ fontSize: '0.72rem' }}
              onClick={onClearAll}
              disabled={events.length === 0}
              title="Smaže celý inbox tohoto závodu včetně nepotvrzených"
            >
              <i className="bi bi-trash me-1"></i>Smazat vše
            </button>
          </div>
        </div>

        <div style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          {events.length === 0 ? (
            <div className="text-center text-muted py-4 px-3 small">
              Zatím nepřišla žádná serial událost.
            </div>
          ) : (
            <div className="p-2">
              {hiddenCount > 0 && (
                <div className="d-flex align-items-center justify-content-between gap-2 text-muted small px-1 pb-1">
                  <span>
                    Zobrazeno {visibleEvents.length} z {events.length} uložených událostí
                    (starší vyřízené jsou skryté, ale nejsou smazané).
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary py-0 px-2 text-nowrap"
                    style={{ fontSize: '0.72rem' }}
                    onClick={() => onShowAllChange(true)}
                  >
                    Zobrazit všech {events.length}
                  </button>
                </div>
              )}
              {showAll && events.length > INBOX_RENDER_LIMIT && (
                <div className="d-flex align-items-center justify-content-between gap-2 text-muted small px-1 pb-1">
                  <span>Zobrazeny všechny uložené události ({events.length}).</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary py-0 px-2 text-nowrap"
                    style={{ fontSize: '0.72rem' }}
                    onClick={() => onShowAllChange(false)}
                  >
                    Jen posledních {INBOX_RENDER_LIMIT}
                  </button>
                </div>
              )}
              {visibleEvents.map((evt) => {
                const resolution = resolutions.get(evt.id) || EMPTY_RESOLUTION;
                return (
                  <BridgeEventRow
                    key={evt.id}
                    event={evt}
                    resolvedEntry={resolution.entry}
                    candidateCount={resolution.count}
                    candidateIndex={resolution.index}
                    excludedMatch={Boolean(resolution.excluded)}
                    fallbackTargetRound={targetRound}
                    onCycle={onCycle}
                    onConfirm={onConfirm}
                    onReject={onReject}
                    onRejectAuto={onRejectAuto}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
