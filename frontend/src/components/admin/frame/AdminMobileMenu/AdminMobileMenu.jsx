import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon, useDialog } from '../../../ms/index.js';
import { currentSeasonInfo } from '../../../site/siteInfo.js';
import SectionSwitch from '../../../backoffice/SectionSwitch/SectionSwitch.jsx';
import AdminBrand from '../AdminBrand/AdminBrand.jsx';
import AdminNav from '../AdminNav/AdminNav.jsx';
import AdminUser from '../AdminUser/AdminUser.jsx';
import styles from './AdminMobileMenu.module.css';

/**
 * Menu administrace pod 1024 px (AdminMobilMenu): panel na navy-deep
 * přes levý okraj (na telefonu celá šířka) se stejnými položkami jako
 * postranní panel, přepínačem sekcí, správcem a odhlášením. Chování
 * dialogu z kitu (useDialog); výběr položky nebo změna adresy ho zavře.
 */
export default function AdminMobileMenu({ id, open, onClose, admin, counts, onLogout }) {
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

  return (
    <dialog {...dialogProps} id={id} aria-label="Menu administrace" className={styles.menu}>
      {open && (
        <div className={styles.panel}>
          <div className={styles.top}>
            <AdminBrand size="sm" subtitle={`${edition} ročník · ${season}`} className={styles.brand} />
            <button type="button" data-cancel aria-label="Zavřít menu" className={styles.close} onClick={() => onClose('button')}>
              <Icon name="close" size={24} strokeWidth={2.2} />
            </button>
          </div>

          <AdminNav variant="menu" counts={counts} onNavigate={close} className={styles.nav} />

          <div className={styles.bottom}>
            <SectionSwitch current="admin" block onNavigate={close} />
            <AdminUser admin={admin} onLogout={onLogout} />
          </div>
        </div>
      )}
    </dialog>
  );
}
