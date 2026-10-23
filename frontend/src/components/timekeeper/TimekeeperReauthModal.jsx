import { useEffect, useState } from 'react';
import { useTimekeeperAuth } from '../../config/timekeeperAuth.jsx';
import { ButtonSpinner } from '../ui/LoadingState.jsx';
import { isOnline, onConnectivityChange } from '../../offline/connectivity.js';


/**
 * Přihlášení v okně na místě, když přihlášení vypršelo (401).
 *
 * Časomíra se kvůli vypršelému přihlášení nikdy neodhlašuje ani nepřesměrovává:
 * obrazovka, rozepsané časy, sériový port i offline fronta zůstávají. Po
 * přihlášení fronta pokračuje sama (timekeeperAuth.jsx). Offline se okno
 * neukazuje - přihlásit se bez sítě nejde a měřit se dá dál.
 */
export default function TimekeeperReauthModal() {
  const { reauthRequired, user, login } = useTimekeeperAuth();
  const [online, setOnline] = useState(isOnline());
  const [email, setEmail] = useState(user?.email && user.email !== 'offline' ? user.email : '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Skutečné spojení se serverem (connectivity.js), ne jen navigator.onLine.
  useEffect(() => onConnectivityChange(setOnline), []);

  useEffect(() => {
    if (!email && user?.email && user.email !== 'offline') setEmail(user.email);
  }, [user, email]);

  if (!reauthRequired || !online) return null;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await login(email.trim(), password);
    setBusy(false);
    if (result.success) {
      setPassword('');
    } else {
      setError(result.error || 'Přihlášení se nezdařilo');
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="tk-reauth-title">
        <div className="modal-dialog modal-dialog-centered">
          <form className="modal-content" onSubmit={submit}>
            <div className="modal-header">
              <h5 className="modal-title" id="tk-reauth-title">
                <i className="bi bi-person-lock me-2"></i>Přihlášení vypršelo
              </h5>
            </div>
            <div className="modal-body">
              <p className="small text-muted mb-3">
                Nic se neztratilo: měření, rozepsané časy i neodeslané změny zůstávají v zařízení.
                Po přihlášení se fronta odešle sama a můžete pokračovat, kde jste skončili.
              </p>
              {error && <div className="alert alert-danger py-2 small">{error}</div>}
              <div className="mb-2">
                <label className="form-label small" htmlFor="tk-reauth-email">E-mail</label>
                <input
                  id="tk-reauth-email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="form-label small" htmlFor="tk-reauth-password">Heslo</label>
                <input
                  id="tk-reauth-password"
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? <ButtonSpinner /> : <i className="bi bi-box-arrow-in-right me-1"></i>}
                Přihlásit a pokračovat
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
}
