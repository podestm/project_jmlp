import { useEffect, useState } from 'react';
import { useTimekeeperAuth } from '../../../../config/timekeeperAuth.jsx';
import { preloadPdfMake } from '../../../../pdf/pdfmake.js';
import { cx } from '../../../ms/cx.js';
import { useSelectedRace } from '../selectedRace.js';
import TabBar from '../TabBar/TabBar.jsx';
import TkMobileMenu from '../TkMobileMenu/TkMobileMenu.jsx';
import TopBar from '../TopBar/TopBar.jsx';
import styles from './TimekeeperLayout.module.css';

const MENU_ID = 'casomira-menu-mobil';

/**
 * Rámec časomíry (TkPrehled): horní lišta s vybraným závodem a třemi stavy,
 * lišta sekce a obsah. Pod 1024 px místo lišty sekce mobilní menu.
 * Obsah je převedená obrazovka (kořen TkPage) nebo LegacyIsland variant="tk".
 */
export default function TimekeeperLayout({ children }) {
  const { user, logout } = useTimekeeperAuth();
  const { race } = useSelectedRace();
  const [menuOpen, setMenuOpen] = useState(false);

  // Tiskové balíky (pdfmake, písma) se načtou na pozadí hned po přihlášení:
  // první tisk je pak okamžitý a funguje i po výpadku sítě (service worker
  // je má v keši). Zpoždění, ať nebrzdí první vykreslení obrazovky.
  useEffect(() => {
    const timer = setTimeout(preloadPdfMake, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={styles.layout}>
      <header className={cx('ms-scope', styles.header)}>
        <TopBar race={race} menuId={MENU_ID} menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} />
        <div className={styles.tabs}>
          <TabBar user={user} onLogout={logout} />
        </div>
        <TkMobileMenu
          id={MENU_ID}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          race={race}
          user={user}
          onLogout={logout}
        />
      </header>
      <main id="obsah" className={styles.main}>{children}</main>
    </div>
  );
}
