import { useState } from 'react';
import { useTimekeeperAuth } from '../../config/timekeeperAuth.jsx';
import Alert from '../ui/Alert.jsx';

export default function TimekeeperLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useTimekeeperAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    
    if (!result.success) {
      setError(result.error || 'Přihlášení se nezdařilo');
    }
    
    setLoading(false);
  };

  return (
    <div className="container-fluid vh-100" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      <div className="row justify-content-center align-items-center vh-100">
        <div className="col-md-6 col-lg-4">
          <div className="text-center mb-4">
            <div className="d-inline-flex align-items-center justify-content-center mb-3" style={{
              width: '72px',
              height: '72px',
              background: 'linear-gradient(135deg, #e94560 0%, #c23152 100%)',
              borderRadius: '18px',
              boxShadow: '0 8px 24px rgba(233, 69, 96, 0.4)'
            }}>
              <i className="bi bi-stopwatch-fill text-white" style={{ fontSize: '36px' }}></i>
            </div>
            <h2 className="text-white fw-bold mb-1">JMLP Časomíra</h2>
            <p className="text-white-50">Zadávání časů a správa závodů</p>
          </div>
          
          <div className="card shadow-lg border-0" style={{ borderRadius: '16px' }}>
            <div className="card-body p-4">
              {error && (
                <Alert 
                  type="danger" 
                  message={
                    <>
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>
                      {error}
                    </>
                  }
                  onDismiss={() => setError('')}
                />
              )}
              
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="tk-email" className="form-label fw-semibold">
                    <i className="bi bi-envelope me-1"></i> Email
                  </label>
                  <input
                    type="email"
                    className="form-control form-control-lg"
                    id="tk-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder="email@example.com"
                    style={{ borderRadius: '10px' }}
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="tk-password" className="form-label fw-semibold">
                    <i className="bi bi-lock me-1"></i> Heslo
                  </label>
                  <input
                    type="password"
                    className="form-control form-control-lg"
                    id="tk-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{ borderRadius: '10px' }}
                  />
                </div>
                
                <button
                  type="submit"
                  className="btn btn-lg w-100 text-white fw-semibold"
                  disabled={loading}
                  style={{ 
                    background: 'linear-gradient(135deg, #e94560 0%, #c23152 100%)',
                    borderRadius: '10px',
                    border: 'none',
                    padding: '12px'
                  }}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Přihlašování...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-box-arrow-in-right me-2"></i>
                      Přihlásit se
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
          
          <div className="text-center mt-3">
            <a href="/" className="text-white-50 text-decoration-none small">
              <i className="bi bi-arrow-left me-1"></i> Zpět na web
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
