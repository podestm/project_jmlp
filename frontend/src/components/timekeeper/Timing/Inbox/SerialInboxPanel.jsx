import { Button, EmptyState, IconButton, Tooltip } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
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
 *   (přepínač je v lepivé liště časomíry, tady jen slovy)
 * @param {function} onRejectAuto    „Zamítnout“ u automaticky zapsané události
 * @param {string}   className       umístění v obrazovce (lepivý panel vedle tabulky)
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
  onDismissUnparsed,
  onClearResolved,
  onClearAll,
  className,
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
    <section className={cx(styles.panel, className)} aria-labelledby="schranka-impulzu">
      <header className={styles.header}>
        <h2 id="schranka-impulzu" className={styles.title}>Schránka impulzů</h2>
        <span className={styles.round}>Kolo {targetRound}</span>
        {summary.toDecide > 0 && <span className={styles.decideCount}>K rozhodnutí {summary.toDecide}</span>}
      </header>

      <p className={styles.summary}>
        <span>Automatický zápis <strong className={autoWrite ? styles.on : styles.off}>{autoWrite ? 'zapnut' : 'vypnut'}</strong></span>
        <span><strong className={styles.num}>{summary.autoWritten}</strong> zapsáno automaticky</span>
        <span><strong className={styles.num}>{summary.toDecide}</strong> k rozhodnutí</span>
        <span><strong className={styles.num}>{summary.rejected}</strong> zamítnuto</span>
      </p>

      {hiddenCount > 0 && (
        <div className={styles.limit}>
          <span>
            Zobrazeno {visibleEvents.length} z {events.length} uložených událostí.
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
          <Tooltip text="Označí je jako zamítnuté" placement="top">
            <Button size="sm" onClick={onDismissUnparsed}>Odbavit nerozpoznané ({unparsedCount})</Button>
          </Tooltip>
        )}
        <Tooltip text="Potvrzené a zamítnuté řádky" placement="top">
          <Button size="sm" onClick={onClearResolved} disabled={resolvedCount === 0}>Smazat vyřízené</Button>
        </Tooltip>
        <Tooltip text="Včetně nepotvrzených" placement="top">
          <IconButton icon="trash" label="Smazat vše" onClick={onClearAll} disabled={events.length === 0} />
        </Tooltip>
      </footer>
    </section>
  );
}
