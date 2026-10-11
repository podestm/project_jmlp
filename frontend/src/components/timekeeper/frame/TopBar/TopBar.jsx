import { Link } from 'react-router-dom';
import znak from '../../../../assets/images/jmlp_znak_88.png';
import { useSeasonInfo } from '../../../site/siteInfo.js';
import RaceSwitcher from '../RaceSwitcher/RaceSwitcher.jsx';
import StatusChips from '../StatusChips/StatusChips.jsx';
import styles from './TopBar.module.css';

/**
 * Horní lišta časomíry (TkPrehled, 76 px): identita, vybraný závod a tři
 * stavy. Pod 1280 px ze značky zůstane jen znak.
 */
export default function TopBar({ race }) {
  const { edition, season } = useSeasonInfo();

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

      <StatusChips className={styles.chips} />
    </div>
  );
}
