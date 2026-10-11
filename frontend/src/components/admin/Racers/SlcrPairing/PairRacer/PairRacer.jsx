import styles from './PairRacer.module.css';

/** Závodník u nás: příjmení a jméno, pod tím ročník · klub · ID závodníka. */
export default function PairRacer({ racer }) {
  return (
    <span className={styles.racer}>
      <span className={styles.name}>{racer.surname} {racer.name}</span>
      <span className={styles.details}>
        <span className={styles.num}>{racer.year}</span> · {racer.club || 'bez klubu'} · ID{' '}
        {racer.slcr_id ? <span className={styles.num}>{racer.slcr_id}</span> : '—'}
      </span>
    </span>
  );
}
