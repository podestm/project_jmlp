import { memo } from 'react';
import { Badge, Button, IconButton, Table, TableScroll } from '../../../ms/index.js';
import { racerName, sexLabel } from '../racers.js';
import SlcrName from '../SlcrName/SlcrName.jsx';
import styles from './RacerTable.module.css';

/**
 * Jeden řádek tabulky.
 *
 * Memoizovaný schválně: při psaní do hledání se překresluje celá obrazovka,
 * ale data samotných řádků se nemění – bez memo by React zbytečně přepočítal
 * všech sto. Předpokladem je, že `onEdit` i `onDelete` jsou stabilní
 * (useCallback v hooku), jinak memo nic neušetří.
 */
const RacerRow = memo(function RacerRow({ racer, onEdit, onDelete }) {
  const name = racerName(racer);
  return (
    <tr>
      <td className={styles.name}><SlcrName racer={racer}>{name}</SlcrName></td>
      <td>{sexLabel(racer.sex) && <Badge size="sm">{sexLabel(racer.sex)}</Badge>}</td>
      <td data-numeric>{racer.birthYear}</td>
      <td>{racer.category_name ? <Badge size="sm">{racer.category_name}</Badge> : '–'}</td>
      <td className={racer.club_name ? undefined : styles.muted}>{racer.club_name || 'Bez klubu'}</td>
      <td className={styles.mono}>{racer.idSlcr || '–'}</td>
      <td data-align="end">
        <span className={styles.actions}>
          <Button size="sm" onClick={() => onEdit(racer)} aria-label={`Upravit závodníka ${name}`}>Upravit</Button>
          <IconButton icon="trash" variant="quiet" label={`Smazat závodníka ${name}`} onClick={() => onDelete(racer)} />
        </span>
      </td>
    </tr>
  );
});

/** Tabulka závodníků (AdminZavodnici, od 768 px). */
export default function RacerTable({ racers, onEdit, onDelete }) {
  return (
    <TableScroll label="Závodníci" className={styles.wrap}>
      <Table caption="Závodníci">
        <thead>
          <tr>
            <th scope="col">Závodník</th>
            <th scope="col">Pohlaví</th>
            <th scope="col">Ročník</th>
            <th scope="col">Kategorie</th>
            <th scope="col">Klub</th>
            <th scope="col">SLČR</th>
            <th scope="col" data-align="end">Akce</th>
          </tr>
        </thead>
        <tbody>
          {racers.map((racer) => <RacerRow key={racer.id} racer={racer} onEdit={onEdit} onDelete={onDelete} />)}
        </tbody>
      </Table>
    </TableScroll>
  );
}
