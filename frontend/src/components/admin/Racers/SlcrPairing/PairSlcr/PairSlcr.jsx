import { Fragment } from 'react';
import { Icon, VisuallyHidden } from '../../../../ms/index.js';
import styles from './PairSlcr.module.css';

const NEW_WINDOW = ' (otevře se v evidenci SLČR v novém okně)';

/**
 * Člen evidence SLČR: odkaz do evidence, ročník · číslo (ID závodníka)
 * a případní další kandidáti; bez shody „Nenalezen“.
 */
export default function PairSlcr({ slcr, alternatives }) {
  if (!slcr) return <span className={styles.missing}>Nenalezen</span>;
  return (
    <span className={styles.slcr}>
      <a href={slcr.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
        {slcr.surname} {slcr.name}
        <Icon name="external-link" size={14} />
        <VisuallyHidden>{NEW_WINDOW}</VisuallyHidden>
      </a>
      <span className={styles.details}>
        {slcr.year ? <span className={styles.num}>{slcr.year}</span> : 'ročník neuveden'} · číslo{' '}
        {slcr.race_code ? <span className={styles.num}>{slcr.race_code}</span> : '—'}
      </span>
      {alternatives?.length > 0 && (
        <span className={styles.details}>
          Další kandidáti:{' '}
          {alternatives.map((alt, index) => (
            // Čárka drží u odkazu, aby se řádek nezalomil před ní.
            <Fragment key={alt.member_id || index}>
              {index > 0 && ' '}
              <span className={styles.altItem}>
                <a href={alt.url} target="_blank" rel="noopener noreferrer" className={styles.alt}>
                  {alt.surname} {alt.name}
                  {alt.race_code ? <> (<span className={styles.num}>{alt.race_code}</span>)</> : null}
                  <VisuallyHidden>{NEW_WINDOW}</VisuallyHidden>
                </a>
                {index < alternatives.length - 1 && ','}
              </span>
            </Fragment>
          ))}
        </span>
      )}
    </span>
  );
}
