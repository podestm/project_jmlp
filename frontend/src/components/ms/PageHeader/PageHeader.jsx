import { cx } from '../cx.js';
import styles from './PageHeader.module.css';

/**
 * Záhlaví stránky: nadtitulek (eyebrow), H1, popis a akce vpravo.
 * - variant public: H1 42 px (veřejný web)
 * - variant app: H1 27 px a `meta` hned za ním na řádku (administrace, časomíra)
 */
export default function PageHeader({ variant = 'public', eyebrow, title, meta, description, actions, className }) {
  return (
    <header className={cx(styles.header, styles[variant], className)}>
      <div className={styles.text}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          {meta && <span className={styles.meta}>{meta}</span>}
        </div>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
