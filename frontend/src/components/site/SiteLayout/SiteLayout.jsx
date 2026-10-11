import SiteFooter from '../SiteFooter/SiteFooter.jsx';
import SiteHeader from '../SiteHeader/SiteHeader.jsx';
import styles from './SiteLayout.module.css';

/**
 * Rámec veřejného webu: hlavička, obsah a patička. Obsah je buď převedená
 * obrazovka (kořen Screen), nebo stará stránka v <LegacyIsland variant="public">.
 * Samotný <main> nemá .ms-scope, aby reset nového UI nesahal na staré stránky.
 * - footer="full": velká patička (úvod)
 */
export default function SiteLayout({ footer, children }) {
  return (
    <div className={styles.site}>
      <SiteHeader />
      <main id="obsah" className={styles.main}>{children}</main>
      <SiteFooter full={footer === 'full'} />
    </div>
  );
}
