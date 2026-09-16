import EmptyState from '../ui/EmptyState.jsx';
import TimingRow from './TimingRow.jsx';

/** Sdílená prázdná hodnota - nový objekt na řádek by rozbil memoizaci TimingRow. */
const EMPTY_TIMES = Object.freeze({});

/**
 * Hlavička zamčeného kola. Zašedlá, ale čitelná: při opacity 0.5 vycházel
 * kontrast 3.12:1, teď 4.9:1. Že je kolo zamčené, říká hlavně ikona zámku.
 */
const LOCKED_HEADER_STYLE = Object.freeze({ opacity: 0.65 });

/**
 * Tabulka pro zadávání časů.
 *
 * Řádek je memoizovaný v TimingRow.jsx, proto sem chodí handlery, které si
 * rodič drží v useCallback. Jakmile některý z nich začne měnit identitu,
 * memoizace přestane platit a startovka o 250 řádcích se překreslí při každé
 * stisknuté klávese.
 */
export default function TimingTable({
  entries,
  editedTimes,
  activeRound,
  hasWriteLock,
  showCategory,
  registerInput,
  onTimeChange,
  onKeyDown,
  onBlur,
  onToggleFlag,
  startListEmpty,
}) {
  return (
    <>
      {entries.length > 0 ? (
        <div className="card border-0 shadow-sm" style={{ borderRadius: '10px' }}>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: '0.8rem' }}>
                <thead style={{ background: '#1a1a2e', color: '#fff' }}>
                  <tr>
                    <th style={{ width: '60px', padding: '5px 6px', borderRadius: '10px 0 0 0' }}>Poř.</th>
                    <th style={{ width: '96px', padding: '5px 6px' }}>Dres</th>
                    <th style={{ minWidth: '170px', padding: '5px 6px' }}>Závodník</th>
                    <th style={{ width: '90px', padding: '5px 6px', ...(activeRound === '2' ? LOCKED_HEADER_STYLE : {}) }}>
                      J1 {activeRound === '2' && <i className="bi bi-lock-fill" style={{ fontSize: '0.6rem' }}></i>}
                    </th>
                    <th style={{ width: '90px', padding: '5px 6px', ...(activeRound === '1' ? LOCKED_HEADER_STYLE : {}) }}>
                      J2 {activeRound === '1' && <i className="bi bi-lock-fill" style={{ fontSize: '0.6rem' }}></i>}
                    </th>
                    <th style={{ width: '72px', padding: '5px 6px' }}>Součet</th>
                    <th style={{ width: '118px', padding: '5px 6px', borderRadius: '0 10px 0 0' }}>Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <TimingRow
                      key={entry.id}
                      entry={entry}
                      times={editedTimes[entry.id] || EMPTY_TIMES}
                      activeRound={activeRound}
                      hasWriteLock={hasWriteLock}
                      showCategory={showCategory}
                      registerInput={registerInput}
                      onTimeChange={onTimeChange}
                      onKeyDown={onKeyDown}
                      onBlur={onBlur}
                      onToggleFlag={onToggleFlag}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : startListEmpty ? (
        <EmptyState
          icon="bi-list-ul"
          title="Startovní listina je prázdná"
          action={(
            <a href="/timekeeper/start-list" className="btn btn-sm btn-outline-primary">
              <i className="bi bi-list-ol me-1"></i>Přejít na startovní listinu
            </a>
          )}
        />
      ) : (
        <EmptyState icon="bi-check-circle" title="Žádné záznamy pro vybraný filtr" />
      )}
    </>
  );
}
