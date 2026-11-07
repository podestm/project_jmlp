import { Button } from '../../../ms/index.js';
import { PAGE_SIZE, formatCount } from '../racers.js';
import styles from './ShowMore.module.css';

/** Dlouhý výpis: kolik je vidět, kolik zbývá, a tlačítko na další stovku (AdminZavodnici). */
export default function ShowMore({ shown, total, onMore }) {
  if (total <= shown) return null;
  return (
    <div className={styles.bar}>
      <p className={styles.text}>
        Zobrazeno <strong>{formatCount(shown)}</strong> z <strong>{formatCount(total)}</strong>{' '}
        závodníků
      </p>
      <Button size="sm" icon="chevron-down" onClick={onMore}>
        Zobrazit dalších {Math.min(PAGE_SIZE, total - shown)}
      </Button>
    </div>
  );
}
