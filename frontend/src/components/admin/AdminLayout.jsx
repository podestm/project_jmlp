import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../config/auth.jsx';

export default function AdminLayout({ children }) {
  const { admin, logout } = useAuth();
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/admin' && location.pathname === '/admin') return true;
    if (path !== '/admin' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <div 
        className="bg-dark text-white d-flex flex-column" 
        style={{ 
          width: '280px',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto'
        }}
      >
        {/* Header with logo/icon */}
        <div className="p-4 border-bottom border-secondary bg-gradient" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
          <div className="d-flex align-items-center mb-2">
            <div className="me-3" style={{ 
              width: '48px', 
              height: '48px', 
              background: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(13, 110, 253, 0.3)'
            }}>
              <i className="bi bi-gear-fill text-white" style={{ fontSize: '24px' }}></i>
            </div>
            <div>
              <h5 className="mb-0 fw-bold">JMLP Admin</h5>
              <small className="text-white-50">Správa závodů</small>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="p-3 flex-grow-1">
          <div className="nav nav-pills flex-column">
            <Link to="/admin" className={`nav-link text-white ${isActive('/admin') ? 'active' : ''}`}>
              <i className="bi bi-speedometer2 me-2"></i>
              Dashboard
            </Link>
            <Link to="/admin/races" className={`nav-link text-white ${isActive('/admin/races') ? 'active' : ''}`}>
              <i className="bi bi-trophy me-2"></i>
              Závody
            </Link>
            <Link to="/admin/racers" className={`nav-link text-white ${isActive('/admin/racers') ? 'active' : ''}`}>
              <i className="bi bi-people me-2"></i>
              Závodníci
            </Link>
            <Link to="/admin/documents" className={`nav-link text-white ${isActive('/admin/documents') ? 'active' : ''}`}>
              <i className="bi bi-file-text me-2"></i>
              Dokumenty
            </Link>
            <Link to="/admin/posts" className={`nav-link text-white ${isActive('/admin/posts') ? 'active' : ''}`}>
              <i className="bi bi-newspaper me-2"></i>
              Posty a zprávy
            </Link>
            <Link to="/admin/season-results" className={`nav-link text-white ${isActive('/admin/season-results') ? 'active' : ''}`}>
              <i className="bi bi-trophy-fill me-2"></i>
              Celkové výsledky
            </Link>
            <Link to="/admin/categories" className={`nav-link text-white ${isActive('/admin/categories') ? 'active' : ''}`}>
              <i className="bi bi-tag me-2"></i>
              Kategorie
            </Link>
            
            <hr className="border-secondary my-3" />
            
            <Link to="/admin/register" className={`nav-link text-white ${isActive('/admin/register') ? 'active' : ''}`}>
              <i className="bi bi-person-plus me-2"></i>
              Nový administrátor
            </Link>
          </div>
        </nav>
        
        {/* User info at bottom */}
        <div className="p-3 border-top border-secondary" style={{ marginTop: 'auto', background: 'rgba(0,0,0,0.2)' }}>
          <div className="d-flex align-items-center mb-2">
            <div className="me-2" style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #198754 0%, #146c43 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <i className="bi bi-person-fill text-white" style={{ fontSize: '20px' }}></i>
            </div>
            <div className="flex-grow-1">
              <div className="fw-semibold text-white">{admin?.full_name || admin?.email}</div>
              <small className="text-white-50" style={{ fontSize: '0.75rem' }}>{admin?.email}</small>
            </div>
          </div>
          <button
            onClick={logout}
            className="btn btn-outline-light btn-sm w-100"
            style={{ 
              borderRadius: '8px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            <i className="bi bi-box-arrow-right me-2"></i>
            Odhlásit se
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
        {/* Page content */}
        <main className="flex-grow-1 p-4 admin-layout-content" style={{ overflowY: 'auto', background: '#f8f9fa' }}>
          <div className="container-fluid">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}