import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../config/auth.jsx';
import { AdminAPI } from '../../config/api.js';
import SectionSwitch from '../ui/SectionSwitch.jsx';
import Icon from '../ms/Icon/Icon.jsx';

export default function AdminLayout({ children }) {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const [pendingClubRequests, setPendingClubRequests] = useState(0);

  const refreshClubCount = () => {
    AdminAPI.get('/api/admin/clubs/requests/count')
      .then(data => setPendingClubRequests(data.count || 0))
      .catch(() => {});
  };

  useEffect(() => {
    refreshClubCount();
  }, [location.pathname]);

  useEffect(() => {
    window.addEventListener('club-request-resolved', refreshClubCount);
    return () => window.removeEventListener('club-request-resolved', refreshClubCount);
  }, []);

  const isActive = (path) => {
    if (path === '/admin' && location.pathname === '/admin') return true;
    if (path !== '/admin' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <div 
        className="bg-dark text-white d-flex flex-column admin-sidebar" 
        style={{ 
          width: '280px',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto'
        }}
      >
        {/* Header with logo/icon */}
        <div className="p-4 border-bottom border-secondary" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
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
              <Icon name="gear" className="text-white" style={{ fontSize: '24px' }} />
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
              <Icon name="dashboard" className="me-2" />
              Dashboard
            </Link>
            <Link to="/admin/races" className={`nav-link text-white ${isActive('/admin/races') ? 'active' : ''}`}>
              <Icon name="trophy" className="me-2" />
              Závody
            </Link>
            {/* Aktivní i na podagendách Závodníků (Párování SLČR). */}
            <Link to="/admin/racers" className={`nav-link text-white ${isActive('/admin/racers') ? 'active' : ''}`}>
              <Icon name="users" className="me-2" />
              Závodníci
            </Link>
            <Link to="/admin/club-requests" className={`nav-link text-white d-flex align-items-center justify-content-between ${isActive('/admin/club-requests') ? 'active' : ''}`}>
              <span className="d-flex align-items-center">
                <Icon name="building" className="me-2" />
                Žádosti o kluby
              </span>
              {pendingClubRequests > 0 && (
                <span className="badge bg-warning text-dark ms-1">{pendingClubRequests}</span>
              )}
            </Link>
            <Link to="/admin/documents" className={`nav-link text-white ${isActive('/admin/documents') ? 'active' : ''}`}>
              <Icon name="file-text" className="me-2" />
              Dokumenty
            </Link>
            <Link to="/admin/posts" className={`nav-link text-white ${isActive('/admin/posts') ? 'active' : ''}`}>
              <Icon name="news" className="me-2" />
              Posty a zprávy
            </Link>
            <Link to="/admin/seasons" className={`nav-link text-white ${isActive('/admin/seasons') ? 'active' : ''}`}>
              <Icon name="trophy" className="me-2" />
              Sezóny
            </Link>
            <Link to="/admin/clubs" className={`nav-link text-white ${isActive('/admin/clubs') ? 'active' : ''}`}>
              <Icon name="building" className="me-2" />
              Kluby
            </Link>
            <Link to="/admin/categories" className={`nav-link text-white ${isActive('/admin/categories') ? 'active' : ''}`}>
              <Icon name="tag" className="me-2" />
              Kategorie
            </Link>
            
            <hr className="border-secondary my-3" />
            
            <Link to="/admin/register" className={`nav-link text-white ${isActive('/admin/register') ? 'active' : ''}`}>
              <Icon name="user-plus" className="me-2" />
              Nový administrátor
            </Link>
          </div>
        </nav>
        
        {/* Přepnutí do časomíry - stejný přepínač je dole i v menu časomíry */}
        <div className="px-3 pb-3">
          <SectionSwitch current="admin" />
        </div>

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
              <Icon name="user" className="text-white" style={{ fontSize: '20px' }} />
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
            <Icon name="logout" className="me-2" />
            Odhlásit se
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
        {/* Page content */}
        <main className="flex-grow-1 p-4 admin-layout-content" style={{ overflowY: 'auto' }}>
          <div className="container-fluid">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}