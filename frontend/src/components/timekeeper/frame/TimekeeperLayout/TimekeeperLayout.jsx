import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTimekeeperAuth } from '../../../../config/timekeeperAuth.jsx';
import { useConfirm } from '../../../../hooks/useConfirm.jsx';
import { useSyncStatus } from '../../../../offline/useSyncStatus.js';
import { preloadPdfMake } from '../../../../pdf/pdfmake.js';
import { cx } from '../../../ms/cx.js';
import { logoutConfirm } from '../../dialogs/logoutConfirm.jsx';
import { useSelectedRace } from '../selectedRace.js';
import TabBar from '../TabBar/TabBar.jsx';
import TopBar from '../TopBar/TopBar.jsx';
import styles from './TimekeeperLayout.module.css';

/**
 * Rámec časomíry (TkPrehled): horní lišta s vybraným závodem a třemi stavy
 * a lišta sekce drží spolu nahoře, obsah (obrazovka s kořenem TkPage) se
 * posouvá pod nimi. Časomíra je pro notebooky a tablety: telefon dostane
 * rozvržení tabletu (min. 768 px) s vodorovným posouváním.
 */
export default function TimekeeperLayout({ children }) {
  const { user, logout } = useTimekeeperAuth();
  const { race } = useSelectedRace();
  const { isOnline, queueStats } = useSyncStatus();
  const { confirm, confirmElement } = useConfirm();
  const navigate = useNavigate();

  // Odhlášení s neodeslanou frontou se nejdřív zeptá (jen dotaz, fronta
  // zůstává v zařízení tak jako tak).
  const handleLogout = async () => {
    if (queueStats.total > 0) {
      const choice = await confirm(logoutConfirm({ queueTotal: queueStats.total, isOnline }));
      if (choice === 'sync') navigate('/timekeeper/sync');
      if (choice !== 'logout') return;
    }
    logout();
  };

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
        <TopBar race={race} />
        <TabBar user={user} onLogout={handleLogout} />
      </header>
      <main id="obsah" className={styles.main}>{children}</main>
      {confirmElement}
    </div>
  );
}
