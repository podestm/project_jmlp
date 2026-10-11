import { memo } from 'react';
import { cx } from '../../../../ms/cx.js';
import PairActions from '../PairActions/PairActions.jsx';
import PairMatch from '../PairMatch/PairMatch.jsx';
import PairRacer from '../PairRacer/PairRacer.jsx';
import PairSlcr from '../PairSlcr/PairSlcr.jsx';
import { pairTone } from '../slcrPairing.js';
import styles from './PairList.module.css';

const PairItem = memo(function PairItem({ item, busy, onDecide }) {
  return (
    <li className={cx(styles.item, styles[pairTone(item)])}>
      <PairRacer racer={item.racer} />
      <span className={styles.section}>
        <span className={styles.label}>Evidence SLČR</span>
        <PairSlcr slcr={item.slcr} alternatives={item.alternatives} />
      </span>
      <PairMatch item={item} />
      <PairActions item={item} busy={busy} onDecide={onDecide} className={styles.actions} />
    </li>
  );
});

/** Párování jako seznam karet (pod 768 px místo tabulky). */
export default function PairList({ items, busy, onDecide }) {
  return (
    <ul className={styles.list} aria-label="Párování se SLČR">
      {items.map((item) => (
        <PairItem key={item.racer_id} item={item} busy={busy[item.racer_id]} onDecide={onDecide} />
      ))}
    </ul>
  );
}
