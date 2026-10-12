import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../config/auth.jsx';
import trat from '../../../assets/images/trat.jpg';
import znak from '../../../assets/images/jmlp-znak-inverse.svg';
import { Alert, Button, Field, Icon, Input, PasswordInput } from '../../ms/index.js';
import { CUP_NAME, useSeasonInfo } from '../../site/siteInfo.js';
import styles from './AdminLogin.module.css';

/**
 * Přihlášení do administrace (AdminLogin): bílá karta na navy-deep.
 * Přihlášení je společné s časomírou (auth → authCore). Časoměřič už
 * přihlášený v časomíře sem neprojde – dostane upozornění `deniedUser`
 * a v časomíře zůstává přihlášený.
 */
export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deniedHidden, setDeniedHidden] = useState(false);
  const { login, deniedUser } = useAuth();
  const { edition } = useSeasonInfo();

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
    <div className={styles.page}>
      <img src={trat} alt="" className={styles.photo} />
      <div className={styles.content}>
        <div className={styles.brand}>
          <img src={znak} alt="" width="76" height="76" className={styles.logo} />
          <span className={styles.name}>JMLP Administrace</span>
          <span className={styles.cup}>{CUP_NAME} · {edition} ročník</span>
        </div>

        <form className={styles.card} onSubmit={handleSubmit}>
          <h1 className={styles.title}>Přihlášení</h1>

          {deniedUser && !error && !deniedHidden && (
            <Alert
              type="warning"
              compact
              title={`Účet ${deniedUser.email} smí jen do časomíry.`}
              onDismiss={() => setDeniedHidden(true)}
            >
              Do administrace se přihlaste účtem správce.
            </Alert>
          )}
          {error && (
            <Alert type="danger" compact title={error}>
              Zkontrolujte e-mail i heslo. Hláška zůstane na obrazovce, dokud to nezkusíte znovu.
            </Alert>
          )}

          <Field label="E-mail" id="admin-email">
            <Input
              type="email"
              size="lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              autoFocus
              placeholder="email@example.com"
            />
          </Field>

          <Field label="Heslo" id="admin-password">
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          <Button type="submit" variant="primary" size="lg" block iconEnd="arrow-right" busy={loading} className={styles.submit}>
            {loading ? 'Přihlašování…' : 'Přihlásit se'}
          </Button>

          <p className={styles.hint}>
            <Icon name="lock" size={18} className={styles.hintIcon} />
            <span>
              Jedno přihlášení platí pro administraci i pro <Link to="/timekeeper">časomíru</Link>.
              Účet časoměřiče pustí jen do časomíry.
            </span>
          </p>
        </form>

        <Link to="/" className={styles.back}>
          <Icon name="arrow-left" size={18} />
          <span>Zpět na veřejný web</span>
        </Link>
      </div>
    </div>
  );
}
