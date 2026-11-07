import { cx } from '../cx.js';
import Icon from '../Icon/Icon.jsx';
import styles from './EmptyState.module.css';

/**
 * Prázdný stav (AktualityArchivPrazdne): přerušovaný rámeček, ikona v kruhu,
 * nadpis jako věta („Právě se nezávodí“, ne „Žádná data“), vysvětlení a akce.
 * - size lg (veřejný web) | md (administrace, časomíra)
 * - headingLevel: úroveň nadpisu podle místa na stránce
 */
export default function EmptyState({ icon = 'inbox', title, hint, action, size = 'md', headingLevel = 2, className }) {
  const Heading = `h${headingLevel}`;
  return (
    <section role="status" className={cx(styles.empty, styles[size], className)}>
      <span className={styles.icon}><Icon name={icon} size={size === 'lg' ? 28 : 22} /></span>
      <div className={styles.text}>
        <Heading className={styles.title}>{title}</Heading>
        {hint && <p className={styles.hint}>{hint}</p>}
      </div>
      {action && <div className={styles.actions}>{action}</div>}
    </section>
  );
}
