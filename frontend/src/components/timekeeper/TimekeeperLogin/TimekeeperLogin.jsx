import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTimekeeperAuth } from '../../../config/timekeeperAuth.jsx';
import { useOnline } from '../../../hooks/useOnline.js';
import trat from '../../../assets/images/trat.jpg';
import znak from '../../../assets/images/jmlp_znak_88.png';
import { Alert, Button, Field, Icon, Input, Paska, PasswordInput } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import { CUP_NAME, currentSeasonInfo } from '../../site/siteInfo.js';
import styles from './TimekeeperLogin.module.css';

const FEATURES = [
  {
    icon: 'wifi-off',
    title: 'Měří i bez signálu',
    text: 'Naměřené časy se ukládají rovnou do notebooku a odešlou se samy, až se signál vrátí. Nic se nečeká a nic se neztrácí.',
  },
  {
    icon: 'plug',
    title: 'Čte časomíru přes USB',
    text: 'Sériové zařízení funguje v Chrome nebo Edge a jen na adrese s HTTPS. Impulzy se ukládají i tehdy, když je nikdo hned nepotvrdí.',
  },
  {
    icon: 'lock',
    title: 'Jedno přihlášení pro obě sekce',
    text: 'Kdo je přihlášený v administraci, je přihlášený i tady, a odhlášení platí pro obě sekce. Účet časoměřiče pustí jen do časomíry, správce i do administrace.',
  },
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
  const { edition, season } = currentSeasonInfo();

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
    <div className={cx('ms-scope', styles.page)}>
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
            <p className={styles.lead}>
              Časomíru obsluhuje jeden člověk u startu — v zimě, v rukavicích, na jednom notebooku.
              Proto jsou tu velké cíle, velké číslice a stav spojení pořád na očích.
            </p>
          </div>

          <ul className={styles.features}>
            {FEATURES.map((feature) => (
              <li key={feature.title} className={styles.feature}>
                <Icon name={feature.icon} size={24} className={styles.featureIcon} />
                <span className={styles.featureText}>
                  <span className={styles.featureTitle}>{feature.title}</span>
                  <span>{feature.text}</span>
                </span>
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
              <span>{online ? 'Jste online — přihlásit se teď jde' : 'Jste offline — první přihlášení potřebuje internet'}</span>
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

            <Button type="submit" variant="primary" size="lg" block iconEnd="arrow-right" busy={loading} className={styles.submit}>
              {loading ? 'Přihlašování…' : 'Přihlásit se k časomíře'}
            </Button>

            <div className={styles.hint}>
              <Icon name="info" size={20} className={styles.hintIcon} />
              <span className={styles.hintText}>
                <span className={styles.hintTitle}>Poprvé se přihlaste ještě doma</span>
                <span>
                  První přihlášení na tomto notebooku potřebuje internet. Potom už aplikace jede i bez signálu
                  a sama vás neodhlásí — ani když u trati vypadne spojení na celé dopoledne.
                </span>
              </span>
            </div>
          </div>

          <p className={styles.note}>
            <Icon name="user" size={18} className={styles.noteIcon} />
            <span>
              Účty časoměřičů zakládá komisař soutěže. Správce se tu přihlásí stejným účtem jako
              do <Link to="/admin">administrace</Link> a mezi sekcemi pak přepíná přepínačem Admin / Časomíra.
            </span>
          </p>
        </form>
      </section>
    </div>
  );
}
