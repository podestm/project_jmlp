import { useEffect } from 'react';
import { useConfirm } from '../../hooks/useConfirm.jsx';
import { countUnsyncedQueueItems } from '../../offline/syncQueue.js';
import { Link, useLocation } from 'react-router-dom';
import { useTimekeeperAuth } from '../../config/timekeeperAuth.jsx';
import { useSyncStatus } from '../../offline/useSyncStatus.js';
import { preloadPdfMake } from '../../pdf/pdfmake.js';
import { preloadOfflineRacerData } from '../../offline/racerRegistry.js';
import { preloadSelectedRace } from '../../offline/racePreload.js';
import SectionSwitch from '../ui/SectionSwitch.jsx';

export default function TimekeeperLayout({ children }) {
  const { user, logout } = useTimekeeperAuth();
  const { confirm, confirmElement } = useConfirm();

  // Ruční odhlášení s varováním, když ve frontě něco čeká - po odhlášení by se
  // to odeslalo až po novém přihlášení na tomhle zařízení.
  const handleLogout = async () => {
    let unsynced = 0;
    try {
      unsynced = await countUnsyncedQueueItems();
    } catch {
      unsynced = 0;
    }
    if (unsynced > 0) {
      const go = await confirm({
        title: 'Odhlásit i s neodeslanými změnami?',
        message: `Ve frontě čeká ${unsynced} neodeslaných změn (časy, závodníci). Zůstanou v zařízení a odešlou se až po dalším přihlášení. Pokud je to možné, počkejte na připojení.`,
        confirmLabel: 'Přesto odhlásit',
        variant: 'danger',
        icon: 'bi-box-arrow-right'
      });
      if (!go) return;
    }
    logout();
  };
  const location = useLocation();
  const { syncState, queueStats } = useSyncStatus();

  // Tiskové balíky (pdfmake, písma) se načtou na pozadí hned po přihlášení:
  // první tisk je pak okamžitý a funguje i po výpadku sítě (service worker
  // je má v keši). Zpoždění, ať nebrzdí první vykreslení obrazovky.
  useEffect(() => {
    const timer = setTimeout(preloadPdfMake, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Data pro offline dohlášku (registr závodníků, kategorie, dresy, kluby)
  // a data vybraného závodu do zařízení hned, a znovu po každém obnovení
  // připojení.
  useEffect(() => {
    const preload = () => {
      preloadOfflineRacerData().catch(() => {});
      preloadSelectedRace().catch(() => {});
    };
    const timer = setTimeout(preload, 5000);
    window.addEventListener('online', preload);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', preload);
    };
  }, []);

  const syncMeta = (() => {
    if (syncState === 'offline') {
      return {
        label: 'Offline',
        icon: 'bi-wifi-off',
        style: { background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.35)' }
      };
    }
    if (syncState === 'syncing') {
      return {
        label: 'Synchronizuji',
        icon: 'bi-arrow-repeat',
        style: { background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', border: '1px solid rgba(147, 197, 253, 0.35)' }
      };
    }
    if (syncState === 'error') {
      return {
        label: 'Chyba sync',
        icon: 'bi-exclamation-triangle',
        style: { background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(252, 165, 165, 0.35)' }
      };
    }
    if (syncState === 'conflict') {
      return {
        label: 'Konflikt',
        icon: 'bi-bug',
        style: { background: 'rgba(220, 38, 38, 0.25)', color: '#fecaca', border: '1px solid rgba(254, 202, 202, 0.4)' }
      };
    }
    if (syncState === 'queued') {
      return {
        label: 'Ve frontě',
        icon: 'bi-hourglass-split',
        style: { background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', border: '1px solid rgba(110, 231, 183, 0.35)' }
      };
    }
    return {
      label: 'Online',
      icon: 'bi-wifi',
      style: { background: 'rgba(34, 197, 94, 0.2)', color: '#86efac', border: '1px solid rgba(134, 239, 172, 0.35)' }
    };
  })();

  const isActive = (path) => {
    if (path === '/timekeeper' && location.pathname === '/timekeeper') return true;
    if (path !== '/timekeeper' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      <style>{`
        .timekeeper-sidebar {
          width: clamp(88px, 16vw, 260px);
          flex: 0 0 clamp(88px, 16vw, 260px);
          min-width: 88px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
        }
        .timekeeper-sidebar-link {
          border-radius: 10px;
          padding: 0.7rem 0.85rem;
          line-height: 1.2;
        }
        .timekeeper-sidebar-section {
          margin-top: 0.9rem;
          margin-bottom: 0.45rem;
          padding-left: 0.75rem;
          padding-right: 0.75rem;
        }
        .timekeeper-sidebar-link-icon {
          margin-right: 0.5rem;
        }

        @media (max-width: 1280px) {
          .timekeeper-sidebar-header {
            padding: 1rem 0.6rem !important;
          }
          .timekeeper-sidebar-header-row {
            flex-direction: column;
            align-items: center !important;
            text-align: center;
            gap: 0.45rem;
            margin-bottom: 0 !important;
          }
          .timekeeper-sidebar-brand-icon {
            margin-right: 0 !important;
            width: 42px !important;
            height: 42px !important;
          }
          .timekeeper-sidebar-brand-text,
          .timekeeper-sidebar-section,
          .timekeeper-sidebar-user-text,
          .timekeeper-sidebar-logout-text {
            display: none;
          }
          .timekeeper-sidebar-nav {
            padding: 0.6rem !important;
          }
          .timekeeper-sidebar-link {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.22rem;
            min-height: 58px;
            padding: 0.5rem 0.3rem;
            font-size: 0.68rem;
            text-align: center;
            white-space: normal;
            word-break: keep-all;
          }
          .timekeeper-sidebar-link-icon {
            margin-right: 0;
            font-size: 1rem;
          }
          .timekeeper-sidebar-user {
            padding: 0.6rem !important;
          }
          .timekeeper-sidebar-user-row {
            justify-content: center;
            margin-bottom: 0 !important;
          }
          .timekeeper-sidebar-user-icon {
            margin-right: 0 !important;
          }
          .timekeeper-sidebar-logout-button {
            padding-left: 0.25rem;
            padding-right: 0.25rem;
          }
          .timekeeper-sidebar-switch {
            padding: 0 0.6rem 0.6rem !important;
          }
          /* Úzké menu: polovinu pod polovinu, ikona nad popiskem jako odkazy
             menu. Selektor s body.theme-backoffice, aby přebil admin.css. */
          body.theme-backoffice .timekeeper-sidebar .section-switch {
            flex-direction: column;
          }
          body.theme-backoffice .timekeeper-sidebar .section-switch-option {
            flex-direction: column;
            gap: 0.15rem;
            padding: 0.4rem 0.2rem;
            font-size: 0.68rem;
          }
        }
      `}</style>
      {/* Sidebar */}
      <div 
        className="text-white d-flex flex-column timekeeper-sidebar"
      >
        {/* Header */}
        <div className="p-4 border-bottom timekeeper-sidebar-header" style={{ borderColor: 'rgba(255,255,255,0.1) !important', background: 'rgba(0,0,0,0.2)' }}>
          <div className="d-flex align-items-center mb-2 timekeeper-sidebar-header-row">
            <div className="me-3 timekeeper-sidebar-brand-icon" style={{ 
              width: '48px', 
              height: '48px', 
              background: 'linear-gradient(135deg, #e94560 0%, #c23152 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(233, 69, 96, 0.3)'
            }}>
              <i className="bi bi-stopwatch-fill text-white" style={{ fontSize: '24px' }}></i>
            </div>
            <div className="timekeeper-sidebar-brand-text">
              <h5 className="mb-0 fw-bold">Časomíra</h5>
              <small className="text-white-50">JMLP Timekeeper</small>
            </div>
          </div>
          <div className="d-flex align-items-center justify-content-between gap-2 mt-2">
            <span
              className="badge rounded-pill"
              style={{ fontWeight: 600, ...syncMeta.style }}
            >
              <i className={`bi ${syncMeta.icon} me-1`}></i>
              {syncMeta.label}
            </span>
            <small className="text-white-50">
              Fronta: {queueStats.total}
            </small>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="p-3 flex-grow-1 timekeeper-sidebar-nav">
          <div className="nav nav-pills flex-column">
            <Link 
              to="/timekeeper" 
              className={`nav-link text-white mb-1 timekeeper-sidebar-link ${isActive('/timekeeper') && !isActive('/timekeeper/') ? 'active' : ''}`}
              style={isActive('/timekeeper') && !location.pathname.includes('/timekeeper/') ? { background: 'rgba(233, 69, 96, 0.3)' } : {}}
            >
              <i className="bi bi-speedometer2 timekeeper-sidebar-link-icon"></i>
              <span>Přehled</span>
            </Link>
            
            <div className="mt-3 mb-2 px-3 timekeeper-sidebar-section">
              <small className="text-white-50 text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                Pracovní postup
              </small>
            </div>
            
            <Link 
              to="/timekeeper/start-list" 
              className={`nav-link text-white mb-1 timekeeper-sidebar-link ${isActive('/timekeeper/start-list') ? 'active' : ''}`}
              style={isActive('/timekeeper/start-list') ? { background: 'rgba(233, 69, 96, 0.3)' } : {}}
            >
              <i className="bi bi-list-ol timekeeper-sidebar-link-icon"></i>
              <span>Listina</span>
            </Link>
            <Link
              to="/timekeeper/race-detail"
              className={`nav-link text-white mb-1 timekeeper-sidebar-link ${isActive('/timekeeper/race-detail') ? 'active' : ''}`}
              style={isActive('/timekeeper/race-detail') ? { background: 'rgba(233, 69, 96, 0.3)' } : {}}
            >
              <i className="bi bi-card-heading timekeeper-sidebar-link-icon"></i>
              <span>Údaje</span>
            </Link>
            <Link
              to="/timekeeper/racers"
              className={`nav-link text-white mb-1 timekeeper-sidebar-link ${isActive('/timekeeper/racers') ? 'active' : ''}`}
              style={isActive('/timekeeper/racers') ? { background: 'rgba(233, 69, 96, 0.3)' } : {}}
            >
              <i className="bi bi-people timekeeper-sidebar-link-icon"></i>
              <span>Závodníci</span>
            </Link>
            <Link 
              to="/timekeeper/timing" 
              className={`nav-link text-white mb-1 timekeeper-sidebar-link ${isActive('/timekeeper/timing') ? 'active' : ''}`}
              style={isActive('/timekeeper/timing') ? { background: 'rgba(233, 69, 96, 0.3)' } : {}}
            >
              <i className="bi bi-clock timekeeper-sidebar-link-icon"></i>
              <span>Časy</span>
            </Link>
            <Link 
              to="/timekeeper/results" 
              className={`nav-link text-white mb-1 timekeeper-sidebar-link ${isActive('/timekeeper/results') ? 'active' : ''}`}
              style={isActive('/timekeeper/results') ? { background: 'rgba(233, 69, 96, 0.3)' } : {}}
            >
              <i className="bi bi-trophy timekeeper-sidebar-link-icon"></i>
              <span>Výsledky</span>
            </Link>

            <div className="mt-3 mb-2 px-3 timekeeper-sidebar-section">
              <small className="text-white-50 text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                Nastavení
              </small>
            </div>

            <Link
              to="/timekeeper/device"
              className={`nav-link text-white mb-1 timekeeper-sidebar-link ${isActive('/timekeeper/device') ? 'active' : ''}`}
              style={isActive('/timekeeper/device') ? { background: 'rgba(233, 69, 96, 0.3)' } : {}}
            >
              <i className="bi bi-plug timekeeper-sidebar-link-icon"></i>
              <span>Časomíra</span>
            </Link>
            <Link 
              to="/timekeeper/race-numbers" 
              className={`nav-link text-white mb-1 timekeeper-sidebar-link ${isActive('/timekeeper/race-numbers') ? 'active' : ''}`}
              style={isActive('/timekeeper/race-numbers') ? { background: 'rgba(233, 69, 96, 0.3)' } : {}}
            >
              <i className="bi bi-123 timekeeper-sidebar-link-icon"></i>
              <span>Čísla</span>
            </Link>
            <Link
              to="/timekeeper/sync"
              className={`nav-link text-white mb-1 timekeeper-sidebar-link ${isActive('/timekeeper/sync') ? 'active' : ''}`}
              style={isActive('/timekeeper/sync') ? { background: 'rgba(233, 69, 96, 0.3)' } : {}}
            >
              <i className="bi bi-arrow-repeat timekeeper-sidebar-link-icon"></i>
              <span>Sync centrum</span>
            </Link>
          </div>
        </nav>
        
        {/* Přepnutí do administrace - jen pro správce, časoměřič se do ní nepřihlásí */}
        {user?.role === 'admin' && (
          <div className="px-3 pb-3 timekeeper-sidebar-switch">
            <SectionSwitch current="timekeeper" />
          </div>
        )}

        {/* User info at bottom */}
        <div className="p-3 timekeeper-sidebar-user" style={{ marginTop: 'auto', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="d-flex align-items-center mb-2 timekeeper-sidebar-user-row">
            <div className="me-2 timekeeper-sidebar-user-icon" style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg, #e94560 0%, #c23152 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <i className="bi bi-person-fill text-white" style={{ fontSize: '18px' }}></i>
            </div>
            <div className="flex-grow-1 text-truncate timekeeper-sidebar-user-text">
              <div className="fw-semibold text-white small">{user?.full_name || user?.email}</div>
              <small className="text-white-50" style={{ fontSize: '0.7rem' }}>{user?.role === 'admin' ? 'Admin' : 'Časoměřič'}</small>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-sm w-100 timekeeper-sidebar-logout-button"
            style={{ 
              borderRadius: '8px',
              fontWeight: '500',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              background: 'rgba(255,255,255,0.05)'
            }}
          >
            <i className="bi bi-box-arrow-right me-2"></i>
            <span className="timekeeper-sidebar-logout-text">Odhlásit se</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
        <main className="flex-grow-1 p-4 timekeeper-section" style={{ background: '#f0f2f5', overflowY: 'auto' }}>
          <div className="container-fluid">
            {children}
          </div>
        </main>
      </div>
      {confirmElement}
    </div>
  );
}
