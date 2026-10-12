import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLiveStatus } from '../../../contexts/LiveStatusContext.jsx';
import znak from '../../../assets/images/jmlp-znak.svg';
import { Container, IconButton, LivePill } from '../../ms/index.js';
import { isNavActive, publicLiveNav, publicNav } from '../../ms/navItems.js';
import MobileMenu from '../MobileMenu/MobileMenu.jsx';
import { CUP_NAME, useSeasonInfo } from '../siteInfo.js';
import styles from './SiteHeader.module.css';

const MENU_ID = 'hlavni-menu-mobil';

/**
 * Hlavička veřejného webu (Zavody, MobilZavody): znak a název, šest položek
 * menu a odznak ŽIVĚ, který je vidět vždy. Pod 1024 px místo menu
 * hamburger, který otevře MobileMenu.
 */
export default function SiteHeader() {
  const { pathname } = useLocation();
  const liveRace = useLiveStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const { edition, season } = useSeasonInfo();

  return (
    <header className={styles.header}>
      <Container className={styles.bar}>
        <Link to="/" className={styles.brand} aria-label={`${CUP_NAME} – úvod`}>
          <img src={znak} alt="" width="44" height="44" className={styles.logo} />
          <span className={styles.brandText}>
            <span className={styles.nameFull}>{CUP_NAME}</span>
            <span className={styles.nameShort}>JMLP</span>
            <span className={styles.seasonFull}>{edition} ročník · sezóna {season}</span>
            <span className={styles.seasonShort}>Sezóna {season}</span>
          </span>
        </Link>

        <nav aria-label="Hlavní menu" className={styles.nav}>
          {publicNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={styles.navLink}
              aria-current={isNavActive(item, pathname) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <LivePill to={publicLiveNav.to} live={Boolean(liveRace)} />

        <IconButton
          icon="menu"
          label="Otevřít menu"
          variant="quiet"
          size="lg"
          iconSize={24}
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls={MENU_ID}
          onClick={() => setMenuOpen(true)}
        />
      </Container>

      <MobileMenu id={MENU_ID} open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}
