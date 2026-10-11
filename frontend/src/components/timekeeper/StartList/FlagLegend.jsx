import { Badge } from '../../ms/index.js';
import RaceFlag, { FLAGS } from './RaceFlag.jsx';
import styles from './FlagLegend.module.css';

/** Legenda příznaků pod listinou (TkStartovniListina). */
export default function FlagLegend() {
  return (
    <div className={styles.legend}>
      <ul className={styles.items}>
        {Object.entries(FLAGS).map(([flag, { title }]) => (
          <li key={flag} className={styles.item}><RaceFlag flag={flag} /> {title}</li>
        ))}
        <li className={styles.item}>
          <Badge tone="navy" size="sm">vyřazen</Badge>
          nedorazil – zůstává tu i s dresem, ve startovce, časech ani výsledcích není
        </li>
      </ul>
      <p className={styles.note}>U řádku s příznakem se oba časy zobrazují jako „—“.</p>
    </div>
  );
}
