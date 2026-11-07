import { Link, useLocation } from 'react-router-dom';
import { Badge, Icon } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import { adminNav, isNavActive } from '../../../ms/navItems.js';
import { useSeasonInfo } from '../../../site/siteInfo.js';
import AdminBrand from '../AdminBrand/AdminBrand.jsx';
import styles from './AdminMobileBar.module.css';

/** Kolik žádostí čeká – do přístupného jména tlačítka menu. */
const waitingText = (count) => {
  if (count === 1) return '1 žádost o klub čeká';
  if (count >= 2 && count <= 4) return `${count} žádosti o kluby čekají`;
  return `${count} žádostí o kluby čeká`;
};

/**
 * Horní lišta administrace pod 1024 px (AdminMobilPrehled): identita
 * s názvem obrazovky a tlačítko menu s počtem čekajících žádostí o kluby.
 */
export default function AdminMobileBar({
  menuId,
  menuOpen,
  onOpenMenu,
  pendingClubRequests = 0,
  className,
}) {
  const { pathname } = useLocation();
  const { edition, season } = useSeasonInfo();
  const current = adminNav.find((item) => isNavActive(item, pathname));
  const subtitle = [current?.label, `${edition} ročník ${season}`].filter(Boolean).join(' · ');
  const label =
    pendingClubRequests > 0
      ? `Otevřít menu administrace, ${waitingText(pendingClubRequests)}`
      : 'Otevřít menu administrace';

  return (
    <header className={cx(styles.bar, className)}>
      <Link to="/admin" className={styles.brand} aria-label="Administrace – přehled">
        <AdminBrand size="sm" subtitle={subtitle} />
      </Link>
      <button
        type="button"
        className={styles.menuButton}
        aria-label={label}
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={onOpenMenu}
      >
        {pendingClubRequests > 0 && (
          <Badge tone="count" className={styles.count}>
            {pendingClubRequests}
          </Badge>
        )}
        <Icon name="menu" size={24} />
      </button>
    </header>
  );
}
