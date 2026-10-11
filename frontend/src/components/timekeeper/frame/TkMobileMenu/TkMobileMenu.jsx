import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import znak from '../../../../assets/images/jmlp_znak_88.png';
import { Button, Icon, useDialog } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import { isNavActive, timekeeperNav } from '../../../ms/navItems.js';
import { currentSeasonInfo } from '../../../site/siteInfo.js';
import RaceSwitcher from '../RaceSwitcher/RaceSwitcher.jsx';
import SectionSwitch from '../../../backoffice/SectionSwitch/SectionSwitch.jsx';
import StatusChips from '../StatusChips/StatusChips.jsx';
import { initialsOf, roleLabel } from '../../../backoffice/user.js';
import styles from './TkMobileMenu.module.css';

const raceDay = timekeeperNav.filter((item) => item.group !== 'settings');
const settings = timekeeperNav.filter((item) => item.group === 'settings');

/**
 * Menu časomíry na mobilu (TkMobilMenu): celoobrazovkový dialog na
 * navy-deep. Měřený závod a tři stavy, šest očíslovaných kroků závodního
 * dne, za oddělovačem obecné nastavení, dole přepínač sekcí (jen admin),
 * uživatel a odhlášení. Chování dialogu z kitu (useDialog); výběr položky
 * nebo změna adresy menu zavře.
 */
export default function TkMobileMenu({ id, open, onClose, race, user, onLogout }) {
  const { pathname } = useLocation();
  const dialogProps = useDialog({ open, onClose });
  const { edition, season } = currentSeasonInfo();

  // Zpět/vpřed v prohlížeči změní adresu bez kliknutí na odkaz.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    if (pathnameRef.current !== pathname && open) onClose('navigate');
    pathnameRef.current = pathname;
  }, [pathname, open, onClose]);

  const close = () => onClose('navigate');
  const name = user?.full_name || user?.email || '';

  const item = (entry, marker) => (
    <Link
      key={entry.to}
      to={entry.to}
      className={styles.item}
      aria-current={isNavActive(entry, pathname) ? 'page' : undefined}
      onClick={close}
    >
      <span className={styles.bar} aria-hidden="true" />
      {marker}
      <span className={styles.itemLabel}>{entry.label}</span>
      <Icon name="chevron-right" size={20} strokeWidth={2.2} className={styles.chevron} />
    </Link>
  );

  return (
    <dialog {...dialogProps} id={id} aria-label="Menu časomíry" className={cx('ms-scope', styles.menu)}>
      {open && (
        <div className={styles.panel}>
          <div className={styles.top}>
            <img src={znak} alt="" width="36" height="36" className={styles.logo} />
            <span className={styles.brandText}>
              <span className={styles.name}>Časomíra</span>
              <span className={styles.season}>JMLP · {edition} ročník {season}</span>
            </span>
            <button type="button" data-cancel aria-label="Zavřít menu" className={styles.close} onClick={() => onClose('button')}>
              <Icon name="close" size={24} strokeWidth={2.2} />
            </button>
          </div>

          <div className={styles.status}>
            <RaceSwitcher race={race} layout="plain" />
            <StatusChips onNavigate={close} />
          </div>

          <nav aria-label="Časomíra" className={styles.nav}>
            <span className={styles.section}>Závodní den · v pořadí práce</span>
            {raceDay.map((entry, index) => item(entry, <span className={styles.step} aria-hidden="true">{index + 1}</span>))}
            <span className={cx(styles.section, styles.settings)}>Obecné nastavení · nepatří k závodu</span>
            {settings.map((entry) => item(entry, <Icon name={entry.icon} size={20} className={styles.settingIcon} />))}
          </nav>

          <div className={styles.bottom}>
            {user?.role === 'admin' && <SectionSwitch current="timekeeper" block onNavigate={close} />}
            <div className={styles.user}>
              <span className={styles.avatar} aria-hidden="true">{initialsOf(name)}</span>
              <span className={styles.userText}>
                <span className={styles.userName}>{name}</span>
                <span className={styles.role}>{roleLabel(user?.role)}</span>
              </span>
            </div>
            <Button variant="on-dark" size="lg" icon="logout" block onClick={onLogout}>Odhlásit se</Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
