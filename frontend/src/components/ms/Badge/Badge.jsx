import { cx } from '../cx.js';
import Icon from '../Icon/Icon.jsx';
import styles from './Badge.module.css';

/**
 * Stavový štítek. Význam nese vždy text, barva ho jen podtrhuje.
 * - tone: open (registrace otevřena) | closed (uzavřeno) | live (ŽIVĚ, s tečkou)
 *   | neutral (ukončeno) | dry (suchý závod, upozornění) | navy | count (počet)
 * - size: md (veřejný web) | sm (administrace, tabulky)
 */
export default function Badge({ tone = 'neutral', size = 'md', icon, className, children }) {
  return (
    <span className={cx(styles.badge, styles[tone], styles[size], className)}>
      {tone === 'live' && <span className={styles.dot} aria-hidden="true" />}
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </span>
  );
}
