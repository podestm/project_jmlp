import { NAVIGATION, APP_CONFIG } from '../../config/constants.js';

export default function Navigation({ currentPage, onNavigate }) {
  return (
    <nav className="navbar navbar-dark mb-4">
      <div className="container">
        <div className="d-flex justify-content-between align-items-center w-100">
          {/* Brand */}
          <span 
            className="navbar-brand mb-0 h1 cursor-pointer" 
            onClick={() => onNavigate('uvod')}
          >
            <i className="bi bi-snow2 me-2"></i>
            {APP_CONFIG.FULL_NAME}
          </span>
          
          {/* Navigation Menu */}
          <div className="nav-pills">
            {NAVIGATION.MAIN.slice(0, 3).map((item) => (
              <button
                key={item.key}
                className={`btn ${
                  currentPage === item.key 
                    ? 'btn-light' 
                    : 'btn-outline-light'
                } me-2`}
                onClick={() => onNavigate(item.key)}
              >
                <i className={`${item.icon} me-1`}></i>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}