import { Link, useLocation } from 'react-router-dom';
import { APP_CONFIG } from '../../config/constants.js';

export default function Navigation() {
  const location = useLocation();
  
  // Mapování URL na názvy stránek
  const getPageFromPath = (pathname) => {
    switch (pathname) {
      case '/': return 'uvod';
      case '/terminovka': return 'terminovka';
      case '/archiv-zprav': return 'archiv';
      case '/archiv': return 'archiv'; // fallback pro starou URL
      default: 
        if (pathname.startsWith('/zavod/')) return 'detail';
        return 'uvod';
    }
  };
  
  const currentPage = getPageFromPath(location.pathname);
  
  const navigationItems = [
    { key: 'uvod', label: 'Úvod', icon: 'bi-house', path: '/' },
    { key: 'terminovka', label: 'Termínovka', icon: 'bi-calendar-event', path: '/terminovka' },
    { key: 'archiv', label: 'Archiv zpráv', icon: 'bi-newspaper', path: '/archiv-zprav' }
  ];

  return (
    <nav className="navbar navbar-dark mb-4">
      <div className="container">
        <div className="d-flex justify-content-between align-items-center w-100">
          {/* Brand */}
          <Link to="/" className="navbar-brand mb-0 h1 text-decoration-none">
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
                    ? 'btn-light' 
                    : 'btn-outline-light'
                } me-2 text-decoration-none`}
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