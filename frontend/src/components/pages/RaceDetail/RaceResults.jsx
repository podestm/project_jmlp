import { ButtonLink, Icon, Panel, Paska } from '../../ms/index.js';
import { POINTS_TABLE } from '../../../utils/points.js';
import styles from './RaceDetail.module.css';

const API_BASE = import.meta.env.VITE_API_BASE || '';

/**
 * Odjetý závod (ZavodDetailOdjeto): výsledková listina nebo věta, že se
 * připravuje, rady k hledání v PDF a bodování do poháru (tabulka FIS
 * z utils/points.js – stejná jako na serveru).
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
                <span>Ověřená rozhodčím, platí pro body do poháru. Otevře se jako PDF v nové kartě.</span>
              </span>
              <span className={styles.published}><Icon name="check" size={16} />Zveřejněno</span>
            </a>
          ) : (
            <div className={styles.notice}>
              <span className={styles.noticeIcon}><Icon name="clock" size={22} /></span>
              <div className={styles.noticeText}>
                <h3 className={styles.noticeTitle}>Výsledky se připravují</h3>
                <p>Listina se tu objeví, jakmile ji rozhodčí ověří.</p>
              </div>
            </div>
          )}
          <div className={styles.tip}>
            <Icon name="search" size={18} />
            <div>
              <h3 className={styles.tipTitle}>Hledáte své dítě?</h3>
              <p>V otevřeném PDF použijte hledání – na počítači Ctrl+F, na telefonu volbu „Najít na stránce“ – a zadejte příjmení.</p>
            </div>
          </div>
          <div className={styles.tip}>
            <Icon name="info" size={18} />
            <div>
              <h3 className={styles.tipTitle}>Živý přenos a listina se můžou lišit</h3>
              <p>Časy z přenosu na trati byly neoficiální. Platí jen to, co je ve výsledkové listině.</p>
            </div>
          </div>
        </Panel>
      </section>

      <section className={styles.column} aria-labelledby="body-do-poharu">
        <Paska id="body-do-poharu">Body do poháru</Paska>
        <Panel padding="lg" className={styles.stack}>
          <p>Za každé umístění v kategorii dostane závodník body podle tabulky FIS. Při shodném čase sdílí závodníci pořadí i body.</p>
          <ol className={styles.points}>
            {POINTS_TABLE.slice(0, 10).map((points, index) => (
              <li key={points} className={styles.point}>
                <span className={styles.pointRank}>{index + 1}.</span>
                <span className={styles.pointValue}>{points}</span>
              </li>
            ))}
          </ol>
          <p className={styles.small}>
            Dál to klesá až k jednomu bodu za 30. místo a po jednom bodu dostane i každý další, kdo dojel.
            Za nedokončený, neodstartovaný nebo diskvalifikovaný závod se body nepřidělují.
          </p>
          <div className={styles.season}>
            <p className={styles.noticeTitle}>Pořadí poháru</p>
            <ButtonLink to="/vysledky" variant="primary" iconEnd="arrow-right">Výsledky a pořadí sezóny</ButtonLink>
          </div>
        </Panel>
      </section>
    </>
  );
}
