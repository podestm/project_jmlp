import { Link } from 'react-router-dom';
import znak from '../../../../assets/images/jmlp_znak_88.png';
import { IconButton } from '../../../ms/index.js';
import { currentSeasonInfo } from '../../../site/siteInfo.js';
import RaceSwitcher from '../RaceSwitcher/RaceSwitcher.jsx';
import StatusChips from '../StatusChips/StatusChips.jsx';
import styles from './TopBar.module.css';

/**
 * Horní lišta časomíry (TkPrehled, 76 px): identita, vybraný závod a tři
 * stavy. Pod 1024 px (TkMobilPrehled) znak, závod a hamburger, pod nimi
 * mřížka tří stavů.
 */
export default function TopBar({ race, menuId, menuOpen, onOpenMenu }) {
  const { edition, season } = currentSeasonInfo();

  return (
    <div className={styles.top}>
      <Link to="/timekeeper" className={styles.brand} aria-label="Časomíra – přehled">
        <img src={znak} alt="" width="40" height="40" className={styles.logo} />
        <span className={styles.brandText}>
          <span className={styles.name}>Časomíra</span>
          <span className={styles.season}>JMLP · {edition} ročník {season}</span>
        </span>
      </Link>

      <div className={styles.center}>
        <RaceSwitcher race={race} />
      </div>
      <RaceSwitcher race={race} layout="compact" className={styles.compactRace} />

      <StatusChips className={styles.chips} />

      <IconButton
        icon="menu"
        label="Otevřít menu časomíry"
        variant="on-dark"
        size="lg"
        iconSize={24}
        className={styles.menuButton}
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={onOpenMenu}
      />
    </div>
  );
}
