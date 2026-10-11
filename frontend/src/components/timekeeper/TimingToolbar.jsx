import { formatDateLong } from '../../utils/date.js';
import { ButtonSpinner } from '../ui/LoadingState.jsx';
import ResultsPrintButtons from './ResultsPrintButtons.jsx';
import SerialStatusBar from './SerialStatusBar.jsx';
import { TK_ACCENT, TK_ACCENT_FILL, TK_ACCENT_GRADIENT, TK_ACCENT_TEXT } from './TimekeeperChrome.jsx';
import TimekeeperMessage from './TimekeeperMessage.jsx';
import Icon from '../ms/Icon/Icon.jsx';

/**
 * Ovládací část obrazovky zadávání časů: uložení, výběr závodu, filtry,
 * postup, kategorie a kolo.
 *
 * Nedrží žádný stav - všechno přijde propem. Vytaženo proto, aby v TimingEntry
 * zůstalo jen to, co skutečně řídí zápis času.
 */
export default function TimingToolbar({
  races,
  selectedRace,
  selectedRaceId,
  startListLength,
  categoryList,
  categoryFilteredLength,
  completedCount,
  filter,
  setFilter,
  selectedCategory,
  setSelectedCategory,
  activeRound,
  setActiveRound,
  saving,
  saveAllTimes,
  hasWriteLock,
  message,
  onDismissMessage,
  setSelectedRaceId,
  loading,
  serial,
  bridgeTargetRound,
  setBridgeTargetRound,
  liveInboxCount,
  resolvedInboxCount,
  unassignedInboxCount,
  unparsedStreakAlert,
  onPrintResults,
  printBusy,
}) {
  return (
    <>
    {/* Header with save button */}
    <div className="d-flex justify-content-between align-items-center mb-2">
      <div>
        <h5 className="fw-bold mb-0">
          <Icon name="clock" className="me-2" style={{ color: TK_ACCENT }} />
          Zadávání časů
        </h5>
        <small className="text-muted">Zapište časy jízd pro závodníky</small>
      </div>
      {startListLength > 0 && (
        <button
          className="btn btn-sm text-white"
          style={{ background: TK_ACCENT_GRADIENT, border: 'none', borderRadius: '8px' }}
          onClick={saveAllTimes}
          disabled={saving || !hasWriteLock}
        >
          {saving ? (
            <><ButtonSpinner />Ukládám...</>
          ) : (
            <><Icon name="save" className="me-1" />Uložit vše</>
          )}
        </button>
      )}
    </div>
    <SerialStatusBar
      serial={serial}
      selectedRaceId={selectedRaceId}
      hasWriteLock={hasWriteLock}
      bridgeTargetRound={bridgeTargetRound}
      setBridgeTargetRound={setBridgeTargetRound}
      liveInboxCount={liveInboxCount}
      resolvedInboxCount={resolvedInboxCount}
      unassignedInboxCount={unassignedInboxCount}
      unparsedStreakAlert={unparsedStreakAlert}
    />

    {/* Race info bar (static - no dropdown) */}
    {selectedRace ? (
      <div className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
        <div className="card-body py-2 px-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <Icon name="trophy" style={{ color: TK_ACCENT }} />
              <span className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                {selectedRace.race_nr || `#${selectedRace.id}`} — {selectedRace.areal_name || '?'}
              </span>
              <small className="text-muted">({formatDateLong(selectedRace.datum)})</small>
            </div>
            <div className="d-flex align-items-center gap-2">
              {/* Status filter */}
              {startListLength > 0 && (
                <div className="btn-group btn-group-sm">
                  <button className={`btn py-0 px-2 ${filter === 'all' ? 'btn-dark' : 'btn-outline-dark'}`}
                    style={{ fontSize: '0.75rem' }} onClick={() => setFilter('all')}>
                    Vše ({categoryFilteredLength})
                  </button>
                  <button className={`btn py-0 px-2 ${filter === 'pending' ? 'btn-warning' : 'btn-outline-warning'}`}
                    style={{ fontSize: '0.75rem' }} onClick={() => setFilter('pending')}>
                    Čeká ({categoryFilteredLength - completedCount})
                  </button>
                  <button className={`btn py-0 px-2 ${filter === 'completed' ? 'btn-success' : 'btn-outline-success'}`}
                    style={{ fontSize: '0.75rem' }} onClick={() => setFilter('completed')}>
                    Hotovo ({completedCount})
                  </button>
                </div>
              )}
              {/* Progress */}
              {startListLength > 0 && (
                <div style={{ width: '80px' }}>
                  <div className="progress" style={{ height: '16px', borderRadius: '8px' }}>
                    <div className="progress-bar" style={{
                      width: `${categoryFilteredLength > 0 ? (completedCount / categoryFilteredLength * 100) : 0}%`,
                      background: TK_ACCENT_GRADIENT, borderRadius: '8px', fontSize: '0.65rem'
                    }}>
                      {categoryFilteredLength > 0 ? Math.round(completedCount / categoryFilteredLength * 100) : 0}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    ) : (
      /* Race selector only when no race selected */
      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '10px' }}>
        <div className="card-body py-2 px-3">
          <div className="d-flex align-items-center gap-2">
            <Icon name="trophy" style={{ color: TK_ACCENT }} />
            <select className="form-select form-select-sm" value={selectedRaceId}
              onChange={(e) => setSelectedRaceId(e.target.value)} style={{ borderRadius: '8px' }}>
              <option value="">-- Vyberte závod --</option>
              {races.map(race => (
                <option key={race.id} value={race.id}>
                  {race.race_nr || `#${race.id}`} — {race.areal_name || '?'} ({formatDateLong(race.datum)})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    )}

    {/* Category tabs + Round toggle row */}
    {!loading && selectedRaceId && startListLength > 0 && (
      <div className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
        <div className="card-body py-2 px-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            {/* Category pills */}
            <div className="d-flex align-items-center gap-1 flex-wrap">
              <small className="fw-semibold me-1" style={{ color: TK_ACCENT_TEXT }}>
                <Icon name="tag" className="me-1" />Kat:
              </small>
              <button
                className={`btn py-0 px-2 ${selectedCategory === 'all' ? '' : 'btn-outline-dark'}`}
                style={{
                  fontSize: '0.75rem', borderRadius: '12px',
                  ...(selectedCategory === 'all' ? { background: TK_ACCENT_FILL, color: 'white', border: 'none' } : {})
                }}
                onClick={() => setSelectedCategory('all')}
              >
                Vše ({startListLength})
              </button>
              {categoryList.map(cat => (
                <button key={cat.name}
                  className={`btn py-0 px-2 ${selectedCategory === cat.name ? '' : 'btn-outline-dark'}`}
                  style={{
                    fontSize: '0.75rem', borderRadius: '12px',
                    ...(selectedCategory === cat.name ? { background: TK_ACCENT_FILL, color: 'white', border: 'none' } : {})
                  }}
                  onClick={() => setSelectedCategory(cat.name)}
                >
                  {cat.name} ({cat.count})
                </button>
              ))}
            </div>

            {/* Round toggle */}
            <div className="d-flex align-items-center gap-2">
              <small className="fw-semibold" style={{ color: TK_ACCENT_TEXT }}>
                <Icon name="toggle" className="me-1" />Kolo:
              </small>
              <div className="btn-group btn-group-sm">
                <button className={`btn py-0 px-2 ${activeRound === '1' ? '' : 'btn-outline-dark'}`}
                  style={{
                    fontSize: '0.75rem',
                    ...(activeRound === '1' ? { background: TK_ACCENT_FILL, color: 'white', border: 'none' } : {})
                  }}
                  onClick={() => setActiveRound('1')}>1</button>
                <button className={`btn py-0 px-2 ${activeRound === '2' ? '' : 'btn-outline-dark'}`}
                  style={{
                    fontSize: '0.75rem',
                    ...(activeRound === '2' ? { background: TK_ACCENT_FILL, color: 'white', border: 'none' } : {})
                  }}
                  onClick={() => setActiveRound('2')}>2</button>
                <button className={`btn py-0 px-2 ${activeRound === 'both' ? 'btn-dark' : 'btn-outline-dark'}`}
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => setActiveRound('both')}>Obě</button>
              </div>
              {activeRound !== 'both' && (
                <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>
                  <Icon name="lock" className="me-1" />{activeRound === '1' ? 'K2 zamčeno' : 'K1 zamčeno'}
                </span>
              )}
            </div>
          </div>

          {/* Tisk listin kol rovnou od časomíry */}
          <div className="d-flex align-items-center gap-2 flex-wrap mt-2 pt-2 border-top">
            <small className="fw-semibold" style={{ color: TK_ACCENT_TEXT }}>
              <Icon name="printer" className="me-1" />Tisk:
            </small>
            <ResultsPrintButtons
              label={selectedCategory === 'all' ? 'Vybraná kategorie' : selectedCategory}
              title="Výsledky kol vybrané kategorie"
              busy={printBusy}
              disabled={selectedCategory === 'all'}
              onPrint={(runMode) => onPrintResults(runMode, 'category')}
            />
            <ResultsPrintButtons
              label="Všechny kategorie"
              title="Výsledky kol všech kategorií"
              busy={printBusy}
              onPrint={(runMode) => onPrintResults(runMode, 'all')}
            />
          </div>
        </div>
      </div>
    )}

    <TimekeeperMessage message={message} onDismiss={onDismissMessage} />
    </>
  );
}
