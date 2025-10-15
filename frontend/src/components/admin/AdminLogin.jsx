import React, { useState } from 'react';
import { useAuth } from '../../config/auth.jsx';
import Alert from '../ui/Alert.jsx';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();

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
    <div className="container-fluid vh-100 bg-light">
      <div className="row justify-content-center align-items-center vh-100">
        <div className="col-md-6 col-lg-4">
          <div className="card shadow">
            <div className="card-header bg-primary text-white text-center">
              <h4 className="mb-0">Admin přihlášení</h4>
            </div>
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
                  <label htmlFor="email" className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder="email@example.com"
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="password" className="form-label">Heslo</label>
                  <input
                    type="password"
                    className="form-control"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                </div>
                
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Přihlašování...
                    </>
                  ) : (
                    'Přihlásit se'
                  )}
                </button>
              </form>
              
              {/* Development note - remove in production */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-3 text-center text-muted">
                  <small>
                    Vstup, kdo s dobrým úmyslem přicházíš.
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}