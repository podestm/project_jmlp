import { Button, Icon, Paska } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import styles from './LiveLog.module.css';

const KIND = {
  time: { icon: 'check', label: 'čas nebo stav' },
  info: { icon: 'info', label: 'hlášení časomíry' },
  unknown: { icon: 'question', label: 'nerozpoznaný řádek' },
};

/**
 * Živý záznam z časomíry (TkZarizeni vpravo): tmavá plocha, čas příchodu,
 * značka druhu řádku (ikona i text v legendě) a řádek, jak přišel.
 */
export default function LiveLog({ log, onClear }) {
  return (
    <section className={styles.section} aria-labelledby="zivy-zaznam">
      <Paska
        id="zivy-zaznam"
        aside={
          log.length > 0 && (
            <Button size="sm" variant="quiet" onClick={onClear}>
              Vymazat záznam
            </Button>
          )
        }
      >
        Živý záznam z časomíry
      </Paska>
      <div className={styles.log}>
        {log.length === 0 ? (
          <p className={styles.waiting}>Čekám na data z časomíry…</p>
        ) : (
          <ol className={styles.lines} aria-label="Řádky z časomíry">
            {log.map((entry, index) => (
              <li key={index} className={cx(styles.line, styles[entry.kind])}>
                <span className={styles.time}>{entry.time}</span>
                <Icon name={KIND[entry.kind].icon} size={14} className={styles.mark} />
                <span className={styles.text}>{entry.text}</span>
              </li>
            ))}
          </ol>
        )}
        <ul className={styles.legend}>
          <li>
            <Icon name="check" size={14} /> {KIND.time.label} (např. <code>11 65 5.16</code>,{' '}
            <code>00:03:07 16 213 188.19</code>, <code>18 12 DNF</code>)
          </li>
          <li>
            <Icon name="info" size={14} /> {KIND.info.label}
          </li>
          <li>
            <Icon name="question" size={14} /> {KIND.unknown.label}
          </li>
        </ul>
      </div>
    </section>
  );
}
