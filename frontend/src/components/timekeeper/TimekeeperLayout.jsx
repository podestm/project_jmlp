import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTimekeeperAuth } from '../../config/timekeeperAuth.jsx';

export default function TimekeeperLayout({ children }) {
  const { user, logout } = useTimekeeperAuth();
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/timekeeper' && location.pathname === '/timekeeper') return true;
    if (path !== '/timekeeper' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <div 
        className="text-white d-flex flex-column" 
        style={{ 
          width: '260px',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)'
        }}
      >
        {/* Header */}
        <div className="p-4 border-bottom" style={{ borderColor: 'rgba(255,255,255,0.1) !important', background: 'rgba(0,0,0,0.2)' }}>
          <div className="d-flex align-items-center mb-2">
            <div className="me-3" style={{ 
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
            <div>
              <h5 className="mb-0 fw-bold">Časomíra</h5>
              <small className="text-white-50">JMLP Timekeeper</small>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="p-3 flex-grow-1">
          <div className="nav nav-pills flex-column">
            <Link 
              to="/timekeeper" 
              className={`nav-link text-white mb-1 ${isActive('/timekeeper') && !isActive('/timekeeper/') ? 'active' : ''}`}
              style={isActive('/timekeeper') && !location.pathname.includes('/timekeeper/') ? { background: 'rgba(233, 69, 96, 0.3)' } : {}}
            >
              <i className="bi bi-speedometer2 me-2"></i>
              Přehled závodů
            </Link>
            
            <div className="mt-3 mb-2 px-3">
              <small className="text-white-50 text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                Pracovní postup
              </small>
            </div>
            
            <Link 
              to="/timekeeper/start-list" 
              className={`nav-link text-white mb-1 ${isActive('/timekeeper/start-list') ? 'active' : ''}`}
              style={isActive('/timekeeper/start-list') ? { background: 'rgba(233, 69, 96, 0.3)' } : {}}
            >
              <i className="bi bi-list-ol me-2"></i>
              Startovní listina
            </Link>
            <Link 
              to="/timekeeper/timing" 
              className={`nav-link text-white mb-1 ${isActive('/timekeeper/timing') ? 'active' : ''}`}
              style={isActive('/timekeeper/timing') ? { background: 'rgba(233, 69, 96, 0.3)' } : {}}
            >
              <i className="bi bi-clock me-2"></i>
              Zadávání časů
            </Link>
            <Link 
              to="/timekeeper/results" 
              className={`nav-link text-white mb-1 ${isActive('/timekeeper/results') ? 'active' : ''}`}
              style={isActive('/timekeeper/results') ? { background: 'rgba(233, 69, 96, 0.3)' } : {}}
            >
              <i className="bi bi-trophy me-2"></i>
              Výsledky
            </Link>

            <div className="mt-3 mb-2 px-3">
              <small className="text-white-50 text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                Nastavení
              </small>
            </div>

            <Link 
              to="/timekeeper/race-numbers" 
              className={`nav-link text-white mb-1 ${isActive('/timekeeper/race-numbers') ? 'active' : ''}`}
              style={isActive('/timekeeper/race-numbers') ? { background: 'rgba(233, 69, 96, 0.3)' } : {}}
            >
              <i className="bi bi-123 me-2"></i>
              Startovní čísla
            </Link>
          </div>
        </nav>
        
        {/* User info at bottom */}
        <div className="p-3" style={{ marginTop: 'auto', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="d-flex align-items-center mb-2">
            <div className="me-2" style={{
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
            <div className="flex-grow-1 text-truncate">
              <div className="fw-semibold text-white small">{user?.full_name || user?.email}</div>
              <small className="text-white-50" style={{ fontSize: '0.7rem' }}>{user?.role === 'admin' ? 'Admin' : 'Časoměřič'}</small>
            </div>
          </div>
          <button
            onClick={logout}
            className="btn btn-sm w-100"
            style={{ 
              borderRadius: '8px',
              fontWeight: '500',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              background: 'rgba(255,255,255,0.05)'
            }}
          >
            <i className="bi bi-box-arrow-right me-2"></i>
            Odhlásit se
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
    </div>
  );
}
