import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTimekeeperAuth } from '../../../config/timekeeperAuth.jsx';
import { useOnline } from '../../../hooks/useOnline.js';
import trat from '../../../assets/images/trat.jpg';
import znak from '../../../assets/images/jmlp-znak-inverse.svg';
import { Alert, Button, Field, Icon, Input, Paska, PasswordInput, Tooltip } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import { CUP_NAME, useSeasonInfo } from '../../site/siteInfo.js';
import styles from './TimekeeperLogin.module.css';

const FEATURES = [
  { icon: 'wifi-off', title: 'Měří i bez signálu' },
  { icon: 'plug', title: 'Čte časomíru přes USB' },
  { icon: 'lock', title: 'Jedno přihlášení pro obě sekce' },
];

/**
 * Přihlášení do časomíry (TkLogin): vlevo navy panel s tím, k čemu
 * časomíra je, vpravo formulář. Přihlášení je společné s administrací
 * (timekeeperAuth → authCore), tady se mění jen vzhled.
 */
export default function TimekeeperLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const online = useOnline();
  const { login } = useTimekeeperAuth();
  const { edition, season } = useSeasonInfo();

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
      <section className={styles.intro} aria-label="Časomíra JMLP">
        <img src={trat} alt="" className={styles.photo} />
        <div className={styles.introBody}>
          <div className={styles.brand}>
            <img src={znak} alt="" width="46" height="46" className={styles.logo} />
            <span className={styles.brandText}>
              <span className={styles.brandName}>JMLP · Časomíra</span>
              <span className={styles.brandSeason}>{CUP_NAME} · {edition} ročník {season}</span>
            </span>
          </div>

          <div className={styles.claim}>
            <h1 className={styles.title}>Nářadí k trati,<br />ne kancelář.</h1>
          </div>

          <ul className={styles.features}>
            {FEATURES.map((feature) => (
              <li key={feature.title} className={styles.feature}>
                <Icon name={feature.icon} size={24} className={styles.featureIcon} />
                <span className={styles.featureTitle}>{feature.title}</span>
              </li>
            ))}
          </ul>

          <Link to="/" className={styles.back}>
            <Icon name="arrow-left" size={18} />
            <span>Zpět na veřejný web</span>
          </Link>
        </div>
      </section>

      <section className={styles.formSide}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <Paska>Přihlášení do časomíry</Paska>

          <div className={styles.card}>
            <p className={cx(styles.connection, online ? styles.online : styles.offline)} role="status">
              <Icon name={online ? 'wifi' : 'wifi-off'} size={20} />
              <span>{online ? 'Jste online' : 'Jste offline – první přihlášení potřebuje internet'}</span>
            </p>

            {error && (
              <Alert type="danger" compact title="Přihlášení se nezdařilo" onDismiss={() => setError('')}>
                {error}
              </Alert>
            )}

            <Field label="E-mail" id="tk-email">
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

            <Field label="Heslo" id="tk-password">
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>

            <Tooltip text="Poprvé se přihlaste ještě doma">
              <Button type="submit" variant="primary" size="lg" block iconEnd="arrow-right" busy={loading} className={styles.submit}>
                {loading ? 'Přihlašování…' : 'Přihlásit se k časomíře'}
              </Button>
            </Tooltip>
          </div>
        </form>
      </section>
    </div>
  );
}
