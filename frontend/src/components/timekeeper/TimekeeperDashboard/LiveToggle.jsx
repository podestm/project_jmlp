import { Button } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import styles from './LiveToggle.module.css';

/**
 * Přepínač živého přenosu závodu na webu (/zive). Stav nese text
 * i aria-pressed, červená tečka ho jen podtrhuje.
 */
export default function LiveToggle({ live, size = 'md', onToggle }) {
  return (
    <Button
      variant="outline"
      size={size}
      aria-pressed={Boolean(live)}
      title={live ? 'Ukončit live přenos' : 'Spustit live přenos'}
      className={cx(styles.live, live && styles.on)}
      onClick={onToggle}
    >
      <span className={styles.dot} aria-hidden="true" />
      {live ? 'Přenos ŽIVĚ běží · ukončit' : 'Spustit přenos ŽIVĚ'}
    </Button>
  );
}
