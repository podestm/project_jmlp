import { memo } from 'react';
import { Button, IconButton, Tooltip } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import BibNumber from '../../BibNumber/BibNumber.jsx';
import RaceFlag from '../../StartList/RaceFlag.jsx';
import { eventDestination, eventStatus, isAutoWrittenEvent, isLockedEvent } from './inboxView.js';
import styles from './BridgeEventRow.module.css';

const REASON_LABELS = {
  read_only_tab: 'Karta je jen pro čtení',
  missing_bib: 'Chybí platné číslo dresu – čas zapište ručně',
  duplicate_ignored: 'Duplicitní událost byla ignorována',
  invalid_time: 'Neplatný formát času',
  unsupported_type: 'Nepodporovaný typ události',
  unparsed: 'Řádek se nepodařilo rozpoznat',
  bib_not_found: 'Číslo dresu není ve startovní listině',
  bib_excluded: 'Závodník je vyřazený ze startky – vraťte ho v Listině',
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
  round_occupied:
    'Kolo je obsazené – automaticky se nepřepisuje, zkontrolujte a případně potvrďte ručně',
  auto_rejected: 'Zamítnuto',
  ready: '',
};

export const formatBridgeReason = (reason) => {
  if (reason === null || reason === undefined) return '';
  return reason in REASON_LABELS ? REASON_LABELS[reason] : reason;
};

/** Důvody, které řádek neopakuje: stav už říká odznak, nebo nejsou co říct. */
const SILENT_REASONS = new Set(['ready', 'multiple_matches', 'auto_rejected']);

const FLAG_TYPES = new Set(['DNF', 'DNS', 'DSQ']);

const clockOf = (ts) =>
  new Date(ts).toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/**
 * Jedna událost z časomíry ve schránce impulzů (TkZadavaniCasu,
 * TkSchrankaImpulzuLog). Memoizovaná, aby psaní času nepřestavovalo celou
 * schránku.
 *
 * Řádek NEROZHODUJE, komu čas patří. Dřív si kandidáty skládal sám a mohl
 * ukázat jednoho závodníka a potvrzení zapsat jinému. TimingEntry rozhodne jednou
 * a pošle výsledek: `resolvedEntry` je přesně ten, komu potvrzení zapíše.
 *
 * @param {Object|null} resolvedEntry závodník, kterému řádek patří
 * @param {number} candidateCount kolik závodníků má tenhle dres
 * @param {number} candidateIndex pořadí resolvedEntry mezi nimi, -1 když nikdo
 * @param {boolean} excludedMatch dres patří jen vyřazenému ze startky – řádek
 *   to řekne místo obecného „není ve startovní listině“
 */
const BridgeEventRow = memo(function BridgeEventRow({
  event,
  resolvedEntry,
  candidateCount = 0,
  candidateIndex = -1,
  excludedMatch = false,
  fallbackTargetRound,
  onCycle,
  onConfirm,
  onReject,
  onRejectAuto,
}) {
  const bib = event.bib == null ? null : Number(event.bib);
  const selectedEntry = resolvedEntry || null;
  const type = String(event.type || '').toUpperCase();

  // 'saving' je zamčené jen během skutečného ukládání – řádek osiřelý po pádu
  // karty vrátí pravidelná kontrola do 'pending', takže nikdy nezamrzne.
  const isLockedRow = isLockedEvent(event);
  const isAutoWritten = isAutoWrittenEvent(event);
  // Uložený důvod vzniká jednou, vyřazení se ale může změnit kdykoli –
  // proto se o něm rozhoduje až tady, z aktuální startovky.
  const reason = excludedMatch && !isLockedRow ? 'bib_excluded' : event.reason;
  const canChangeCandidate = candidateCount > 1 && !isLockedRow;
  const isUnparsed = event.reason === 'unparsed';
  // Typ mimo TIME/DNS/DNF/DSQ nejde nikam zapsat (dřív potvrzení smazalo
  // závodníkovi příznak) – nepotvrditelný stejně jako nerozpoznaný řádek.
  const isUnsupportedType = event.reason === 'unsupported_type';
  const status = eventStatus(event, { candidateCount, candidateIndex });
  const destination = eventDestination(event);
  const round = event.targetRound || fallbackTargetRound;
  // KOMU potvrzení zapíše. Bez toho ukazoval sdílený dres ze dvou sad dvakrát totéž
  // číslo a obsluha potvrzovala naslepo.
  const racerLabel = selectedEntry
    ? `${selectedEntry.racer_surname || ''} ${selectedEntry.racer_name || ''}`.trim() || 'Bez jména'
    : '';
  // Kategorie a startovní číslo vždycky, ne jen u sdíleného dresu: obsluha
  // podle nich kontroluje, že impulz patří tomu, kdo právě jel. Jméno a st. č.
  // první – při zkrácení trojtečkou zmizí jako první kategorie.
  const racerLine = selectedEntry
    ? [
        racerLabel,
        selectedEntry.start_number != null ? `st. č. ${selectedEntry.start_number}` : null,
        selectedEntry.category_name,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const reasonText =
    !SILENT_REASONS.has(reason) && reason !== 'round_occupied' ? formatBridgeReason(reason) : '';
  const occupiedText =
    reason === 'round_occupied' && !isLockedRow ? formatBridgeReason(reason) : '';
  // Druhý řádek: komu se čas zapíše; bez závodníka rovnou proč. Důvod
  // u přiřazeného závodníka dostane vlastní třetí řádek – jen když něco říká.
  const deviceProblem =
    isUnparsed || isUnsupportedType
      ? `${formatBridgeReason(event.reason)} – zkontrolujte nastavení časomíry.${isUnsupportedType ? ' Čas zapište ručně.' : ''}`
      : '';
  const detail = deviceProblem || racerLine || reasonText;
  const note = [racerLine && !deviceProblem ? reasonText : '', occupiedText]
    .filter(Boolean)
    .join(' ');

  const bibNumber = (
    <BibNumber
      number={selectedEntry?.race_number_actual ?? bib ?? '?'}
      setColor={selectedEntry?.set_color}
      plain={!selectedEntry}
      size="sm"
    />
  );

  return (
    <div className={styles.row} data-tone={status.tone} data-locked={isLockedRow || undefined}>
      <div className={styles.bibCell}>
        {canChangeCandidate ? (
          <button
            type="button"
            className={styles.cycle}
            onClick={() => onCycle(event.id)}
            // Vlastní řádek zařízení: číslo jde vždy ověřit proti tomu, co
            // opravdu přišlo z časomíry.
            title={`${event.raw || `dres ${bib ?? '?'}`} – klik přepne kandidáta/sadu`}
          >
            {bibNumber}
          </button>
        ) : (
          <span title={event.raw || `dres ${bib ?? '?'}`}>{bibNumber}</span>
        )}
        <span className={styles.clock}>{clockOf(event.ts)}</span>
      </div>

      <div className={styles.main}>
        <p className={styles.head}>
          {isUnparsed ? (
            <code className={styles.raw} title={event.raw || ''}>
              {event.raw || '(prázdný řádek)'}
            </code>
          ) : (
            <span className={styles.value}>
              {FLAG_TYPES.has(type) ? (
                <RaceFlag flag={type.toLowerCase()} />
              ) : (
                <span className={styles.time}>{event.time ? event.time : 'bez času'}</span>
              )}
              <span className={styles.round}>{`→ kolo ${round}`}</span>
            </span>
          )}
          <span className={cx(styles.status, styles[status.tone])}>{status.text}</span>
          {destination && <span className={styles.destination}>{destination}</span>}
        </p>
        {detail && (
          <p className={styles.detail} title={detail}>
            {detail}
          </p>
        )}
        {note && <p className={styles.note}>{note}</p>}
      </div>

      {isAutoWritten ? (
        <Tooltip text="Vrátí kolo před zápisem" placement="top" className={styles.action}>
          <Button size="sm" icon="undo" onClick={() => onRejectAuto?.(event.id)}>
            Zamítnout
          </Button>
        </Tooltip>
      ) : (
        !isLockedRow && (
          <div className={styles.actions}>
            <IconButton
              icon="check"
              label="Přiřadit a uložit"
              title="Přiřadit a uložit"
              variant={canChangeCandidate ? 'primary' : 'outline'}
              onClick={() => onConfirm(event.id, selectedEntry ? selectedEntry.id : null)}
              disabled={!selectedEntry || isUnparsed || isUnsupportedType}
            />
            <IconButton
              icon="close"
              label="Zamítnout událost"
              title="Zamítnout událost"
              onClick={() => onReject(event.id)}
            />
          </div>
        )
      )}
    </div>
  );
});

export default BridgeEventRow;
