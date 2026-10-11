import Navigation from './Navigation.jsx';
import Icon from '../ms/Icon/Icon.jsx';

export default function Layout({ children, fluid }) {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      {/* Navigation */}
      <Navigation />
      
      {/* Main Content */}
      <main style={{ flex: '1 0 auto' }} className="main-content">
        {fluid ? (
          children
        ) : (
          <div className="content-wrapper">
            <div className="row justify-content-center">
              <div className="col-lg-10">
                {children}
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer 
        className="bg-light border-top py-4" 
        style={{ 
          marginTop: 'auto',
          flexShrink: 0 
        }}
      >
        <div className="container text-center">
          <div className="row">
            <div className="col-md-6">
              <p className="mb-0 text-muted">
                © 2024 Jihomoravský lyžařský pohár.
              </p>
            </div>
            <div className="col-md-6">
              <div className="d-flex justify-content-center justify-content-md-end">
                <a href="mailto:info@jmlp.cz" className="text-muted me-3" aria-label="Napsat e-mail">
                  <Icon name="mail" />
                </a>
                <a href="tel:+420123456789" className="text-muted" aria-label="Zavolat">
                  <Icon name="smartphone" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}