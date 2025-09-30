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
    <div className="d-flex vh-100">
      {/* Sidebar */}
      <div className="bg-dark text-white" style={{ minWidth: '250px' }}>
        <div className="p-3 border-bottom border-secondary">
          <h5 className="mb-0">JMLP Admin</h5>
          <small className="text-muted">Administrace závodů</small>
        </div>
        
        <nav className="p-3">
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
          </div>
        </nav>
        
        {/* User info at bottom */}
        <div className="mt-auto p-3 border-top border-secondary">
          <div className="d-flex align-items-center">
            <div className="me-2">
              <i className="bi bi-person-circle fs-4"></i>
            </div>
            <div className="flex-grow-1">
              <div className="fw-semibold">{admin?.full_name || admin?.email}</div>
              <small className="text-muted">{admin?.email}</small>
            </div>
          </div>
          <button
            onClick={logout}
            className="btn btn-outline-light btn-sm mt-2 w-100"
          >
            <i className="bi bi-box-arrow-right me-2"></i>
            Odhlásit se
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-grow-1 d-flex flex-column">
        {/* Top navbar */}
        <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom">
          <div className="container-fluid">
            <span className="navbar-brand mb-0 h1">Administrace</span>
            
            <div className="d-flex align-items-center">
              <a href="/" target="_blank" className="btn btn-outline-primary me-2">
                <i className="bi bi-box-arrow-up-right me-1"></i>
                Zobrazit web
              </a>
              <span className="text-muted">
                Přihlášen jako <strong>{admin?.full_name || admin?.email}</strong>
              </span>
            </div>
          </div>
        </nav>

        {/* Page content */}
        <main className="flex-grow-1 p-4 bg-light">
          {children}
        </main>
      </div>
    </div>
  );
}