import { Icon, Panel, Paska } from '../../ms/index.js';
import styles from './RaceDetail.module.css';

const API_BASE = import.meta.env.VITE_API_BASE || '';

/**
 * Odjetý závod (ZavodDetailOdjeto): výsledková listina nebo věta, že se
 * připravuje.
 */
export default function RaceResults({ race }) {
  return (
    <>
      <section className={styles.column} aria-labelledby="vysledky-zavodu">
        <Paska id="vysledky-zavodu">Výsledky závodu</Paska>
        <Panel padding="lg" className={styles.stack}>
          {race.results_file_id ? (
            <a href={`${API_BASE}/races/${race.id}/results`} target="_blank" rel="noopener noreferrer" className={styles.document}>
              <span className={styles.documentIcon}><Icon name="file-text" size={22} /></span>
              <span className={styles.noticeText}>
                <span className={styles.documentTitle}>Oficiální výsledková listina</span>
                <span>PDF</span>
              </span>
              <span className={styles.published}><Icon name="check" size={16} />Zveřejněno</span>
            </a>
          ) : (
            <div className={styles.notice}>
              <span className={styles.noticeIcon}><Icon name="clock" size={22} /></span>
              <div className={styles.noticeText}>
                <h3 className={styles.noticeTitle}>Výsledky se připravují</h3>
              </div>
            </div>
          )}
        </Panel>
      </section>
    </>
  );
}
