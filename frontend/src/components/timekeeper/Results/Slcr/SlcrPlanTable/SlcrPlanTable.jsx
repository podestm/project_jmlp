import { Badge, Table, TableScroll } from '../../../../ms/index.js';
import { cx } from '../../../../ms/cx.js';
import { PLAN_ACTIONS, planRow } from '../slcr.js';
import styles from './SlcrPlanTable.module.css';

/**
 * Náhled kroku 2: co se v akci stane u každé kategorie. Zakládané závody
 * ukazují kodex (= id kategorie), pohlaví a ročníky, které se do evidence
 * pošlou; stav nese text štítku i lišta řádku. Tabulka se posouvá ve svém
 * rámečku (hlavička zůstává nahoře).
 */
export default function SlcrPlanTable({ items, className }) {
  return (
    <TableScroll label="Náhled závodů v akci" className={cx(styles.scroll, className)}>
      <Table density="compact" stickyHeader caption="Závody v akci po kategoriích">
        <thead>
          <tr>
            <th scope="col">Kategorie</th>
            <th scope="col" data-align="end">Kodex</th>
            <th scope="col">Pohlaví</th>
            <th scope="col">Ročníky</th>
            <th scope="col">V evidenci</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const row = planRow(item);
            const action = PLAN_ACTIONS[row.action];
            return (
              <tr key={row.id} data-state={action.state}>
                <td className={styles.name}>{row.name}</td>
                <td data-align="end" data-numeric>{row.codex}</td>
                <td>{row.sex || <span className={styles.muted}>–</span>}</td>
                <td data-numeric className={styles.years}>{row.years || <span className={styles.muted}>–</span>}</td>
                <td>
                  <span className={styles.status}>
                    <Badge size="sm" tone={action.tone}>{action.label}</Badge>
                    {row.slcrName && <span className={styles.slcrName}>{`jako ${row.slcrName}`}</span>}
                    {row.reason && <span className={styles.slcrName}>{row.reason}</span>}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </TableScroll>
  );
}
