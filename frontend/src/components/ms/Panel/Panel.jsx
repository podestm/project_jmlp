import { cx } from '../cx.js';
import styles from './Panel.module.css';

/**
 * Bílá karta s linkou (bez stínu a bez pohybu při hoveru).
 * - padding: none (výpisy DataRow, tabulky) | md | lg
 * - as: section / aside / div …; ostatní atributy (aria-label…) se předají
 */
export default function Panel({ as: Tag = 'div', padding = 'md', className, children, ...rest }) {
  return (
    <Tag className={cx(styles.panel, styles[padding], className)} {...rest}>
      {children}
    </Tag>
  );
}
