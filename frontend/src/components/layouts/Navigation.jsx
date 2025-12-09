import { Link, useLocation } from 'react-router-dom';
import { APP_CONFIG } from '../../config/constants.js';

export default function Navigation() {
  const location = useLocation();
  
  // Mapování URL na názvy stránek
  const getPageFromPath = (pathname) => {
    switch (pathname) {
      case '/': return 'uvod';
      case '/registrace': return 'registrace';
      case '/archiv-zprav': return 'aktuality';
      case '/vysledky': return 'vysledky';
      default: 
        if (pathname.startsWith('/zavod/')) return 'detail';
        return 'uvod';
    }
  };
  
  const currentPage = getPageFromPath(location.pathname);
  
  const navigationItems = [
    { key: 'uvod', label: 'Úvod', icon: 'bi-house', path: '/' },
    { key: 'registrace', label: 'Registrace', icon: 'bi-calendar-event', path: '/registrace' },
    { key: 'aktuality', label: 'Aktuality', icon: 'bi-newspaper', path: '/archiv-zprav' },
    { key: 'vysledky', label: 'Výsledky', icon: 'bi-trophy', path: '/vysledky' }
  ];

  return (
    <nav className="navbar navbar-dark mb-4" style={{
      background: 'rgba(20, 30, 50, 0.6)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div className="container">
        <div className="d-flex justify-content-between align-items-center w-100">
          {/* Brand */}
          <Link to="/" className="navbar-brand mb-0 h1 text-decoration-none" style={{color: '#ffffff', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'}}>
            <i className="bi bi-snow2 me-2"></i>
            {APP_CONFIG.FULL_NAME}
          </Link>
          
          {/* Navigation Menu */}
          <div className="nav-pills">
            {navigationItems.map((item) => (
              <Link
                key={item.key}
                to={item.path}
                className={`btn ${
                  currentPage === item.key 
                    ? 'btn-primary' 
                    : 'btn-outline-light'
                } me-2 text-decoration-none`}
                style={currentPage === item.key ? {
                  borderBottom: '2px solid var(--sunset-orange)',
                  backgroundColor: 'transparent',
                  color: 'var(--sunset-orange)'
                } : {}}
              >
                <i className={`${item.icon} me-1`}></i>
                {item.label}
              </Link>
            ))}
            
            {/* Admin link */}
            <a
              href="/admin"
              className="btn btn-outline-warning text-decoration-none"
              title="Administrace"
            >
              <i className="bi bi-gear me-1"></i>
              Admin
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}