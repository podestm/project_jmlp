import { Button, EmptyState, IconButton, Switch } from '../../../ms/index.js';
import { EMPTY_RESOLUTION } from '../../inboxMatching.js';
import { INBOX_RENDER_LIMIT } from '../../useInboxEvents.js';
import BridgeEventRow from './BridgeEventRow.jsx';
import { autoWriteSummary, groupInboxEvents } from './inboxView.js';
import styles from './SerialInboxPanel.module.css';

/**
 * Schránka impulzů z časomíry (TkZadavaniCasu, TkSchrankaImpulzuLog).
 *
 * Čistě zobrazovací – události drží IndexedDB a komu se čas zapíše, rozhoduje
 * `resolveInboxEvent`. Sem chodí hotové výsledky, aby řádek nemohl ukázat
 * jednoho závodníka a potvrzení zapsat jinému. Výjimky k rozhodnutí jsou
 * nahoře, zapsané a vyřízené pod nimi.
 *
 * @param {Array}  events            všechny uložené události závodu
 * @param {Array}  visibleEvents     ty, které se opravdu vykreslí
 * @param {number} hiddenCount       kolik jich je skrytých (jen vyřízené)
 * @param {boolean} showAll          vykreslují se všechny uložené události
 * @param {function} onShowAllChange přepne mezi posledními a všemi
 * @param {Map}    resolutions       id události -> {entry, count, index, excluded}
 * @param {number} unparsedCount     nerozpoznané řádky ze zařízení
 * @param {number} resolvedCount     vyřízené řádky (potvrzené / zamítnuté)
 * @param {boolean} autoWrite        zapisovat jednoznačné události bez potvrzení
 * @param {function} onAutoWriteChange přepne automatický zápis
 * @param {function} onRejectAuto    „Zamítnout“ u automaticky zapsané události
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
  const { decide, done } = groupInboxEvents(visibleEvents);
  const summary = autoWriteSummary(events);

  const renderRow = (evt) => {
    const resolution = resolutions.get(evt.id) || EMPTY_RESOLUTION;
    return (
      <li key={evt.id}>
        <BridgeEventRow
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
      </li>
    );
  };

  return (
    <section className={styles.panel} aria-labelledby="schranka-impulzu">
      <header className={styles.header}>
        <h2 id="schranka-impulzu" className={styles.title}>Schránka impulzů</h2>
        <span className={styles.round}>Kolo {targetRound}</span>
        {summary.toDecide > 0 && <span className={styles.decideCount}>K rozhodnutí {summary.toDecide}</span>}
      </header>

      <div className={styles.auto}>
        <div className={styles.autoRow}>
          <Switch
            label="Zapisovat automaticky"
            description={autoWrite
              ? 'Jedna shoda, platný čas nebo DNF/DNS a prázdné kolo → rovnou do výsledků.'
              : 'Každý impulz čeká na ruční potvrzení.'}
            checked={autoWrite}
            onChange={(e) => onAutoWriteChange?.(e.target.checked)}
          />
          <span className={autoWrite ? styles.on : styles.off}>{autoWrite ? 'Zapnuto' : 'Vypnuto'}</span>
        </div>
        <p className={styles.summary}>
          <span className={styles.caps}>Kolo {targetRound}</span>
          <span><strong className={styles.num}>{summary.autoWritten}</strong> zapsáno automaticky</span>
          <span><strong className={styles.num}>{summary.toDecide}</strong> k rozhodnutí</span>
          <span><strong className={styles.num}>{summary.rejected}</strong> zamítnuto</span>
        </p>
      </div>

      {hiddenCount > 0 && (
        <div className={styles.limit}>
          <span>
            Zobrazeno {visibleEvents.length} z {events.length} uložených událostí
            (starší vyřízené jsou skryté, ale nejsou smazané).
          </span>
          <Button size="sm" onClick={() => onShowAllChange(true)}>Zobrazit všech {events.length}</Button>
        </div>
      )}
      {showAll && events.length > INBOX_RENDER_LIMIT && (
        <div className={styles.limit}>
          <span>Zobrazeny všechny uložené události ({events.length}).</span>
          <Button size="sm" onClick={() => onShowAllChange(false)}>Jen posledních {INBOX_RENDER_LIMIT}</Button>
        </div>
      )}

      <div className={styles.list}>
        {events.length === 0 ? (
          <EmptyState
            icon="inbox"
            headingLevel={3}
            title="Zatím nepřišel žádný impulz z časomíry"
            hint="Jakmile závodník projede cílem, jeho řádek se tu objeví sám. Zařízení musí být připojené."
          />
        ) : (
          <>
            {decide.length > 0 && (
              <>
                <h3 className={styles.group}>K rozhodnutí <span className={styles.groupCount}>{decide.length}</span></h3>
                <ul className={styles.rows}>{decide.map(renderRow)}</ul>
              </>
            )}
            {done.length > 0 && (
              <>
                <h3 className={styles.group}>Zapsáno a vyřízené</h3>
                <ul className={styles.rows}>{done.map(renderRow)}</ul>
              </>
            )}
          </>
        )}
      </div>

      <footer className={styles.footer}>
        {unparsedCount > 0 && (
          <Button size="sm" onClick={onDismissUnparsed} title="Označí nerozpoznané řádky jako zamítnuté">
            Odbavit nerozpoznané ({unparsedCount})
          </Button>
        )}
        <Button size="sm" onClick={onClearResolved} disabled={resolvedCount === 0} title="Smaže potvrzené a zamítnuté řádky">
          Smazat vyřízené
        </Button>
        <IconButton
          icon="trash"
          label="Smazat vše"
          title="Smaže celou schránku tohoto závodu včetně nepotvrzených"
          onClick={onClearAll}
          disabled={events.length === 0}
        />
      </footer>
    </section>
  );
}
