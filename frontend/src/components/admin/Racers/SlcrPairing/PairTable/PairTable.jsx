import { memo } from 'react';
import { Table, TableScroll } from '../../../../ms/index.js';
import PairActions from '../PairActions/PairActions.jsx';
import PairMatch from '../PairMatch/PairMatch.jsx';
import PairRacer from '../PairRacer/PairRacer.jsx';
import PairSlcr from '../PairSlcr/PairSlcr.jsx';
import { pairTone } from '../slcrPairing.js';
import styles from './PairTable.module.css';

/** Řádek páru; lišta vlevo podle jistoty (text štítku ji vždy doplňuje). */
const PairRow = memo(function PairRow({ item, busy, onDecide }) {
  const tone = pairTone(item);
  return (
    <tr data-state={tone} className={styles[tone]}>
      <td><PairRacer racer={item.racer} /></td>
      <td><PairSlcr slcr={item.slcr} alternatives={item.alternatives} /></td>
      <td><PairMatch item={item} /></td>
      <td data-align="end"><PairActions item={item} busy={busy} onDecide={onDecide} /></td>
    </tr>
  );
});

/** Tabulka párování (AdminParovaniSlcr, od 768 px). */
export default function PairTable({ items, busy, onDecide }) {
  return (
    <TableScroll label="Párování se SLČR" className={styles.wrap}>
      <Table caption="Párování se SLČR" className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.racerCol}>Závodník u nás</th>
            <th scope="col" className={styles.slcrCol}>Evidence SLČR</th>
            <th scope="col">Shoda</th>
            <th scope="col" data-align="end" className={styles.actionsCol}>Akce</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <PairRow key={item.racer_id} item={item} busy={busy[item.racer_id]} onDecide={onDecide} />
          ))}
        </tbody>
      </Table>
    </TableScroll>
  );
}
