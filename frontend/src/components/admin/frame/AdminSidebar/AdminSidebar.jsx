import { Link } from 'react-router-dom';
import { cx } from '../../../ms/cx.js';
import { useSeasonInfo } from '../../../site/siteInfo.js';
import SectionSwitch from '../../../backoffice/SectionSwitch/SectionSwitch.jsx';
import AdminBrand from '../AdminBrand/AdminBrand.jsx';
import AdminNav from '../AdminNav/AdminNav.jsx';
import AdminUser from '../AdminUser/AdminUser.jsx';
import styles from './AdminSidebar.module.css';

/**
 * Postranní panel administrace (AdminDashboard, 256 px na navy-deep):
 * identita, menu, přepínač Admin / Časomíra, přihlášený správce
 * a odhlášení. Od 1024 px; pod tím AdminMobileBar a AdminMobileMenu.
 */
export default function AdminSidebar({ admin, counts, onLogout, className }) {
  const { edition, season } = useSeasonInfo();

  return (
    <aside className={cx(styles.sidebar, className)} aria-label="Menu administrace">
      <Link to="/admin" className={styles.brand} aria-label="Administrace – přehled">
        <AdminBrand subtitle={`${edition} ročník · ${season}`} />
      </Link>

      <AdminNav variant="sidebar" counts={counts} className={styles.nav} />

      <div className={styles.switch}>
        <SectionSwitch current="admin" block />
      </div>

      <AdminUser admin={admin} onLogout={onLogout} className={styles.user} />
    </aside>
  );
}
