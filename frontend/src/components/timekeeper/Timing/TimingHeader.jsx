import { Button, PageHeader } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import styles from './TimingHeader.module.css';

/**
 * Záhlaví zadávání časů (TkZadavaniCasu): název, závod a počet na listině,
 * kdo drží právo zápisu (slovy, tečka ho jen podtrhuje) a Uložit vše.
 */
export default function TimingHeader({ race, startListLength, hasWriteLock, saving, onSaveAll }) {
  const meta = race
    ? `${race.areal_name || race.race_nr || `#${race.id}`} · ${startListLength} na startovní listině`
    : null;

  return (
    <PageHeader
      variant="app"
      title="Zadávání časů"
      meta={meta}
      actions={race && (
        <>
          <span className={styles.lock}>
            <span className={cx(styles.dot, hasWriteLock && styles.dotOn)} aria-hidden="true" />
            {hasWriteLock ? 'Právo zápisu drží tato karta' : 'Jen pro čtení – zápis drží jiná karta'}
          </span>
          {startListLength > 0 && (
            <Button variant="primary" size="lg" icon="save" busy={saving} disabled={!hasWriteLock} onClick={onSaveAll}>
              {saving ? 'Ukládám…' : 'Uložit vše'}
            </Button>
          )}
        </>
      )}
    />
  );
}
