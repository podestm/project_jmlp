import { Icon } from '../../../../ms/index.js';
import { cx } from '../../../../ms/cx.js';
import { CONFIDENCE, PAIR_STATUS, appliedLabels, changeLabels, pairWarnings } from '../slcrPairing.js';
import styles from './PairMatch.module.css';

/**
 * Shoda: štítek jistoty s poznámkou serveru, co potvrzení u nás změní
 * (u potvrzených co se ještě převezme), co se už převzalo a upozornění.
 */
export default function PairMatch({ item }) {
  const confidence = CONFIDENCE[item.confidence];
  const changes = changeLabels(item);
  const applied = appliedLabels(item);
  const warnings = pairWarnings(item);

  return (
    <span className={styles.match}>
      {(confidence || item.note) && (
        <span className={styles.head}>
          {confidence && <span className={cx(styles.confidence, styles[confidence.tone])}>{confidence.label}</span>}
          {item.note && <span className={styles.note}>{item.note}</span>}
        </span>
      )}
      {changes.length > 0 && (
        <span className={styles.line}>
          <Icon name="pencil" size={16} className={cx(styles.lineIcon, styles.changeIcon)} />
          <span>
            {item.status === PAIR_STATUS.confirmed ? 'K převzetí z evidence: ' : 'Potvrzení u nás změní: '}
            <strong>{changes.join(', ')}</strong>
          </span>
        </span>
      )}
      {applied.length > 0 && (
        <span className={cx(styles.line, styles.applied)}>
          <Icon name="check" size={16} className={styles.lineIcon} />
          <span>Převzato z evidence ({applied.join(', ')})</span>
        </span>
      )}
      {warnings.map((warning) => (
        <span key={warning.key} className={styles.warning}>
          <Icon name="warning" size={16} className={styles.warningIcon} />
          <span>{warning.text}</span>
        </span>
      ))}
    </span>
  );
}
