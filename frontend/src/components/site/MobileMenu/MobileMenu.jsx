import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLiveStatus } from '../../../contexts/LiveStatusContext.jsx';
import znak from '../../../assets/images/jmlp_znak_88.png';
import { Icon, useDialog } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import { isNavActive, publicLiveNav, publicNav } from '../../ms/navItems.js';
import { currentSeasonInfo } from '../siteInfo.js';
import styles from './MobileMenu.module.css';

/**
 * Mobilní menu (MobilMenu.dc.html): celoobrazovkový modální dialog na
 * navy-deep – záhlaví se znakem a křížkem, karta ŽIVĚ, šest položek
 * a tlačítko k přihláškám (kalendář závodů). Chování dialogu (Escape,
 * fokus, zámek scrollu) je z kitu (useDialog); fokus jde na „Zavřít menu“.
 * Výběr položky nebo změna adresy menu zavře.
 */
export default function MobileMenu({ id, open, onClose }) {
  const { pathname } = useLocation();
  const liveRace = useLiveStatus();
  const dialogProps = useDialog({ open, onClose });
  const { edition, season, copyright } = currentSeasonInfo();

  // Zpět/vpřed v prohlížeči změní adresu bez kliknutí na odkaz.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    if (pathnameRef.current !== pathname && open) onClose('navigate');
    pathnameRef.current = pathname;
  }, [pathname, open, onClose]);

  const close = () => onClose('navigate');

  return (
    <dialog {...dialogProps} id={id} aria-label="Menu" className={cx('ms-scope', styles.menu)}>
      {open && (
        <div className={styles.panel}>
          <div className={styles.top}>
            <img src={znak} alt="" width="36" height="36" className={styles.logo} />
            <span className={styles.brandText}>
              <span className={styles.name}>JMLP</span>
              <span className={styles.season}>{edition} ročník · {season}</span>
            </span>
            <button type="button" data-cancel aria-label="Zavřít menu" className={styles.close} onClick={() => onClose('button')}>
              <Icon name="close" size={24} strokeWidth={2.2} />
            </button>
          </div>

          <div className={styles.liveWrap}>
            <Link to={publicLiveNav.to} className={cx(styles.live, liveRace && styles.liveOn)} onClick={close}>
              <span className={styles.liveDot} aria-hidden="true" />
              <span className={styles.liveText}>
                <span className={styles.liveTitle}>
                  Živě · {liveRace ? 'právě se závodí' : 'právě se nezávodí'}
                </span>
                {liveRace && <span className={styles.liveHint}>{liveRace.areal_name}</span>}
              </span>
              <Icon name="chevron-right" size={20} strokeWidth={2.4} className={styles.chevron} />
            </Link>
          </div>

          <nav aria-label="Hlavní menu" className={styles.nav}>
            {publicNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={styles.item}
                aria-current={isNavActive(item, pathname) ? 'page' : undefined}
                onClick={close}
              >
                <span className={styles.marker} aria-hidden="true" />
                <span className={styles.itemText}>
                  <span className={styles.itemLabel}>{item.label}</span>
                  {item.hint && <span className={styles.itemHint}>{item.hint}</span>}
                </span>
                <Icon name="chevron-right" size={20} strokeWidth={2.2} className={styles.chevron} />
              </Link>
            ))}
          </nav>

          <div className={styles.bottom}>
            <Link to="/zavody" className={styles.cta} onClick={close}>
              <span>Přihlásit na závod</span>
              <Icon name="arrow-right" size={19} strokeWidth={2.5} />
            </Link>
            <span className={styles.copyright}>{copyright}</span>
          </div>
        </div>
      )}
    </dialog>
  );
}
