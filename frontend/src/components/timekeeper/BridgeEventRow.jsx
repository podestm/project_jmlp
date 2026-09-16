import React from 'react';
import { getRaceNumberBadgeStyle } from '../../utils/raceNumbers.js';

const REASON_LABELS = {
  read_only_tab: 'Karta je jen pro čtení',
  missing_bib: 'Chybí platné číslo dresu – čas zapište ručně',
  duplicate_ignored: 'Duplicitní událost byla ignorována',
  invalid_time: 'Neplatný formát času',
  unsupported_type: 'Nepodporovaný typ události',
  unparsed: 'Řádek se nepodařilo rozpoznat',
  bib_not_found: 'Číslo dresu není ve startovní listině',
  multiple_matches: 'Nalezeno více kandidátů se stejným číslem',
  save_failed: 'Uložení selhalo',
  saving_interrupted: 'Ukládání bylo přerušeno – potvrďte znovu',
  queued_offline: 'Čeká ve frontě na odeslání na server',
  sync_failed: 'Odeslání na server selhalo – čas zapište ručně',
  sync_conflict: 'Konflikt při odesílání – zkontrolujte záznam',
  sync_unknown: 'Nelze ověřit odeslání na server – zkontrolujte záznam',
  sync_superseded: 'Nahrazeno novějším zápisem téhož času – zkontrolujte záznam',
  invalid_json: 'Bridge poslal neplatný JSON',
  manually_rejected: 'Událost byla ručně zamítnuta',
  ready: '',
};

export const formatBridgeReason = (reason) => {
  if (reason === null || reason === undefined) return '';
  return reason in REASON_LABELS ? REASON_LABELS[reason] : reason;
};

const STATUS_CLASSES = {
  saved: 'success',
  queued: 'info',
  save_failed: 'danger',
  rejected: 'secondary',
  warning: 'warning',
};

/**
 * One serial-device event in the timing screen's inbox.
 * Memoised so that typing a time does not rebuild the whole inbox as well.
 *
 * This component does NOT resolve the event to a start-list entry. It used to
 * rebuild the candidate list itself, with a different null `start_number`
 * handling than the confirm handler used, so a row could DISPLAY one racer and
 * ✓ WRITE the measured time to another. TimingEntry now resolves once and
 * passes the outcome in; `resolvedEntry` is exactly the entry the ✓ writes to,
 * and its id is handed back on confirm.
 *
 * @param {Object|null} resolvedEntry the start-list entry this row belongs to
 * @param {number} candidateCount how many entries carry this bib
 * @param {number} candidateIndex position of resolvedEntry among them, -1 if none
 */
const BridgeEventRow = React.memo(function BridgeEventRow({
  event,
  resolvedEntry,
  candidateCount = 0,
  candidateIndex = -1,
  fallbackTargetRound,
  onCycle,
  onConfirm,
  onReject,
}) {
  const bib = event.bib == null ? null : Number(event.bib);
  const selectedEntry = resolvedEntry || null;
  const statusClass = STATUS_CLASSES[event.status] || 'light';

  // 'saving' is locked only while it is genuinely in flight - a row orphaned by
  // a crash is demoted back to 'pending' by the periodic recovery pass, so it
  // can never freeze.
  const isLockedRow = event.status === 'saved'
    || event.status === 'saving'
    || event.status === 'queued'
    || event.status === 'rejected';
  const canChangeCandidate = candidateCount > 1 && !isLockedRow;
  const isUnparsed = event.reason === 'unparsed';
  // An event whose type is none of TIME/DNS/DNF/DSQ cannot be written anywhere:
  // confirming one used to fall into the flag branch and clear the racer's
  // DNF/DNS/DSQ. It is unconfirmable, exactly like an unparsed line.
  const isUnsupportedType = event.reason === 'unsupported_type';
  // WHO the ✓ will write to. Without it a duplicate bib from two number sets
  // showed the same number twice ("1/2" vs "2/2") and the operator confirmed
  // blind - the wrong racer only surfaced when the results were published.
  const racerLabel = selectedEntry
    ? `${selectedEntry.racer_surname || ''} ${selectedEntry.racer_name || ''}`.trim()
    : '';

  return (
    <div
      className={`border rounded-2 px-2 py-1 mb-1 bg-${statusClass}${statusClass === 'light' ? '' : '-subtle'}`}
      style={{ borderColor: event.status === 'pending' ? '#e94560' : '#dee2e6' }}
    >
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <small className="text-muted" style={{ width: '58px', fontSize: '0.7rem' }}>
          {new Date(event.ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </small>
        {isUnparsed ? (
          <code
            className="text-truncate"
            style={{ flex: 1, minWidth: 0, fontSize: '0.72rem', color: '#8a5300' }}
            title={event.raw || ''}
          >
            {event.raw || '(prázdný řádek)'}
          </code>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-sm p-0 border-0"
              onClick={() => onCycle(event.id)}
              disabled={!canChangeCandidate}
              // The device's own line, so the badge's number can always be
              // checked against what actually came off the časomíra.
              title={`${event.raw || `dres ${bib ?? '?'}`}${canChangeCandidate ? ' – klik přepne kandidáta/sadu' : ''}`}
              style={{ height: '28px', width: '32px' }}
            >
              <span className="badge" style={{ ...getRaceNumberBadgeStyle(selectedEntry?.set_color ?? 'rose'), fontSize: '0.75rem' }}>
                {selectedEntry?.race_number_actual ?? (bib ?? '?')}
              </span>
            </button>
            <small className="text-muted text-truncate" style={{ flex: 1, minWidth: 0, fontSize: '0.73rem' }}>
              {event.time ? `${event.time}` : 'bez času'} | K{event.targetRound || fallbackTargetRound}
              {candidateCount > 1 ? ` | ${Math.max(candidateIndex, 0) + 1}/${candidateCount}` : ''}
              {event.reason && event.reason !== 'ready' && event.reason !== 'multiple_matches' ? ` | ${formatBridgeReason(event.reason)}` : ''}
            </small>
          </>
        )}
        <div className="d-flex gap-1 ms-auto">
          <button
            type="button"
            className="btn btn-sm btn-success py-0 px-2"
            style={{ fontSize: '0.85rem', lineHeight: '1' }}
            onClick={() => onConfirm(event.id, selectedEntry ? selectedEntry.id : null)}
            disabled={!selectedEntry || isLockedRow || isUnparsed || isUnsupportedType}
            title="Přiřadit a uložit"
          >
            ✓
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger py-0 px-2"
            style={{ fontSize: '0.85rem', lineHeight: '1' }}
            onClick={() => onReject(event.id)}
            disabled={isLockedRow}
            title="Zamítnout událost"
          >
            ✕
          </button>
        </div>
      </div>
      {!isUnparsed && selectedEntry && (
        <div className="text-truncate" style={{ fontSize: '0.68rem' }} title={racerLabel}>
          <i className="bi bi-person me-1"></i>
          {racerLabel || 'Bez jména'}
          {/* Kategorie a startovní číslo se ukazují vždycky, ne jen když má
              dres víc kandidátů: obsluha podle nich kontroluje, že impulz
              patří tomu, kdo právě jel, a při jednom kandidátovi je ta
              kontrola stejně potřebná jako při dvou. */}
          {selectedEntry.category_name ? ` · ${selectedEntry.category_name}` : ''}
          {selectedEntry.start_number != null ? ` · st. č. ${selectedEntry.start_number}` : ''}
        </div>
      )}
      {(isUnparsed || isUnsupportedType) && (
        <div className="text-warning-emphasis" style={{ fontSize: '0.68rem' }}>
          {formatBridgeReason(event.reason)} – zkontrolujte nastavení časomíry.
          {isUnsupportedType ? ' Čas zapište ručně.' : ''}
        </div>
      )}
    </div>
  );
});

export default BridgeEventRow;
