import { useState } from 'react';
import { useAuth } from '../../../../config/auth.jsx';
import AdminMobileBar from '../AdminMobileBar/AdminMobileBar.jsx';
import AdminMobileMenu from '../AdminMobileMenu/AdminMobileMenu.jsx';
import AdminSidebar from '../AdminSidebar/AdminSidebar.jsx';
import { useClubRequestCount } from '../useClubRequestCount.js';
import styles from './AdminLayout.module.css';

const MENU_ID = 'admin-menu-mobil';

/**
 * Rámec administrace (AdminDashboard): od 1024 px postranní panel 256 px
 * a obsah vedle, pod 1024 px horní lišta s menu (AdminMobilPrehled,
 * AdminMobilMenu). Obsah je obrazovka s kořenem AdminPage.
 */
export default function AdminLayout({ children }) {
  const { admin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const pendingClubRequests = useClubRequestCount();
  const counts = { clubRequests: pendingClubRequests };

  return (
    <div className={styles.layout}>
      <AdminSidebar admin={admin} counts={counts} onLogout={logout} className={styles.sidebar} />
      <AdminMobileBar
        menuId={MENU_ID}
        menuOpen={menuOpen}
        onOpenMenu={() => setMenuOpen(true)}
        pendingClubRequests={pendingClubRequests}
        className={styles.mobileBar}
      />
      <AdminMobileMenu
        id={MENU_ID}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        admin={admin}
        counts={counts}
        onLogout={logout}
      />
      <main id="obsah" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
