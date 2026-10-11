import { memo } from 'react';
import { IconButton, VisuallyHidden } from '../../../ms/index.js';
import { racerName, sexLabel } from '../racers.js';
import styles from './RacerList.module.css';

/** Řádek závodníka: ročník v boxu, jméno, pod ním údaje, vpravo úprava a smazání. */
const RacerItem = memo(function RacerItem({ racer, onEdit, onDelete }) {
  const name = racerName(racer);
  const details = [
    racer.club_name || 'Bez klubu',
    sexLabel(racer.sex),
    racer.category_name,
    racer.idSlcr && `SLČR ${racer.idSlcr}`,
  ].filter(Boolean).join(' · ');

  return (
    <li className={styles.row}>
      <span className={styles.year}>
        <VisuallyHidden>ročník </VisuallyHidden>{racer.birthYear}
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        <span className={styles.details}>{details}</span>
      </span>
      <IconButton icon="pencil" label={`Upravit závodníka ${name}`} onClick={() => onEdit(racer)} />
      <IconButton icon="trash" variant="quiet" label={`Smazat závodníka ${name}`} onClick={() => onDelete(racer)} />
    </li>
  );
});

/** Závodníci jako seznam (pod 768 px místo tabulky). */
export default function RacerList({ racers, onEdit, onDelete }) {
  return (
    <ul className={styles.list} aria-label="Závodníci">
      {racers.map((racer) => <RacerItem key={racer.id} racer={racer} onEdit={onEdit} onDelete={onDelete} />)}
    </ul>
  );
}
