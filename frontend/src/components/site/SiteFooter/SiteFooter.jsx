import { Link } from 'react-router-dom';
import znak from '../../../assets/images/jmlp_znak_88.png';
import svazLogo from '../../../assets/images/svaz_logo_88.png';
import { Container } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import { publicFooterColumns, publicFooterLinks, publicLegalLink, publicNav } from '../../ms/navItems.js';
import { CUP_NAME, useSeasonInfo } from '../siteInfo.js';
import styles from './SiteFooter.module.css';

/**
 * Patička veřejného webu. Na počítači úzká lišta (Zavody), na úvodu velká
 * patička se dvěma sloupci odkazů (Main, `full`). Pod 768 px vždy mobilní
 * varianta (MobilZavody): znak, šest odkazů ve dvou sloupcích, copyright.
 * Odkaz na ochranu osobních údajů je ve všech třech variantách.
 */
export default function SiteFooter({ full = false }) {
  const { edition, season, copyright } = useSeasonInfo();

  return (
    <footer className={cx(styles.footer, full && styles.full)}>
      {full ? (
        <div className={styles.desktop}>
          <Container className={styles.columns}>
            <div className={styles.about}>
              <span className={styles.aboutName}>{CUP_NAME}</span>
              <span className={styles.aboutText}>
                Seriál závodů pro děti a mládež na jižní Moravě. {edition} ročník, sezóna {season}.
              </span>
              <img src={svazLogo} alt="Svaz lyžařů České republiky" width="44" height="44" className={styles.svaz} />
            </div>
            {publicFooterColumns.map((column) => (
              <nav key={column.title} aria-label={column.title} className={styles.column}>
                <span className={styles.columnTitle}>{column.title}</span>
                {column.links.map((link) => (
                  <Link key={link.to} to={link.to} className={styles.columnLink}>{link.label}</Link>
                ))}
              </nav>
            ))}
          </Container>
          <div className={styles.bottomLine}>
            <Container className={styles.bottom}>
              <span className={styles.muted}>{copyright}</span>
              <Link to={publicLegalLink.to} className={styles.legalLink}>{publicLegalLink.label}</Link>
              <span className={cx(styles.muted, styles.credit)}>Fotografie: archiv JMLP</span>
            </Container>
          </div>
        </div>
      ) : (
        <Container className={cx(styles.desktop, styles.slim)}>
          <span className={styles.muted}>{copyright}</span>
          <nav aria-label="Patička" className={styles.slimNav}>
            {[...publicFooterLinks, publicLegalLink].map((link) => (
              <Link key={link.to} to={link.to} className={styles.slimLink}>{link.label}</Link>
            ))}
          </nav>
        </Container>
      )}

      <div className={styles.mobile}>
        <div className={styles.mobileBrand}>
          <img src={znak} alt="" width="44" height="44" className={styles.mobileLogo} />
          <span className={styles.mobileName}>{CUP_NAME}</span>
        </div>
        <nav aria-label="Patička" className={styles.mobileNav}>
          {publicNav.map((item) => (
            <Link key={item.to} to={item.to} className={styles.mobileLink}>{item.label}</Link>
          ))}
        </nav>
        <Link to={publicLegalLink.to} className={styles.legalLink}>{publicLegalLink.label}</Link>
        <span className={styles.mobileCopyright}>{copyright} · {edition} ročník</span>
      </div>
    </footer>
  );
}
