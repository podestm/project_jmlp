import { Link } from 'react-router-dom';
import { Icon } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import styles from './StatusChip.module.css';

/**
 * Jeden stavový odznak horní lišty (model ze statusChips.js): ikona vlevo
 * a popisek nad hodnotou (56 px).
 * - to: odznak je odkaz na obrazovku, kde se stav řeší
 */
export default function StatusChip({ chip, to }) {
  const { tone, icon, label, value, valueMono, detail } = chip;
  const className = cx(styles.chip, styles[tone]);
  const content = (
    <>
      <Icon name={icon} className={styles.icon} />
      <span className={styles.label}>{label}</span>
      <span className={styles.body}>
        <span className={cx(styles.value, valueMono && styles.mono)}>{value}</span>
        {detail.length > 0 && (
          <span className={styles.detail}>
            {detail.map((part) => (
              <span key={part.text} className={part.mono ? styles.detailMono : undefined}>{part.text}</span>
            ))}
          </span>
        )}
      </span>
    </>
  );

  return to
    ? <Link to={to} className={className}>{content}</Link>
    : <span className={className}>{content}</span>;
}
