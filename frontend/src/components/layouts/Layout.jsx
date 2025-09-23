import Navigation from './Navigation.jsx';

export default function Layout({ children, currentPage, onNavigate }) {
  return (
    <div className="min-h-screen d-flex flex-column">
      {/* Navigation */}
      <Navigation currentPage={currentPage} onNavigate={onNavigate} />
      
      {/* Main Content */}
      <main className="main-content flex-grow-1">
        <div className="content-wrapper">
          {children}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-light border-top py-4 mt-auto">
        <div className="container text-center">
          <div className="row">
            <div className="col-md-6">
              <p className="mb-0 text-muted">
                © 2024 Jihomoravský lyžařský pohár. Všechna práva vyhrazena.
              </p>
            </div>
            <div className="col-md-6">
              <div className="d-flex justify-content-center justify-content-md-end">
                <a href="mailto:info@jmlp.cz" className="text-muted me-3">
                  <i className="bi bi-envelope"></i> info@jmlp.cz
                </a>
                <a href="tel:+420123456789" className="text-muted">
                  <i className="bi bi-phone"></i> +420 123 456 789
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}