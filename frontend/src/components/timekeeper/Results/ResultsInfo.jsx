import { Link } from 'react-router-dom';
import { Alert, Icon } from '../../ms/index.js';
import { POINTS_TABLE } from '../../../utils/points.js';
import { formatSeasonShort } from '../../../utils/season.js';
import styles from './ResultsInfo.module.css';

const InfoPanel = ({ icon, title, aside, children }) => (
  <section className={styles.panel}>
    <header className={styles.head}>
      <Icon name={icon} size={20} />
      <h2 className={styles.title}>{title}</h2>
      {aside && <span className={styles.aside}>{aside}</span>}
    </header>
    <div className={styles.body}>{children}</div>
  </section>
);

/**
 * Vysvětlivky pod výsledky (TkVysledky): body podle tabulky FIS,
 * zveřejnění na jmlp.cz (s výstrahou na neodeslanou frontu) a pořadí poháru.
 */
export default function ResultsInfo({ race, queueTotal }) {
  return (
    <div className={styles.grid}>
      <InfoPanel icon="trophy" title="Body podle tabulky FIS">
        <p>
          Body se přidělují podle pořadí v kategorii, od 30. místa po 1 bodu za každé umístění; za DNF, DNS
          i DSQ je nula. Dělené pořadí dostává stejné body.
        </p>
        <ol className={styles.points} aria-label="Body za 1. až 10. místo">
          {POINTS_TABLE.slice(0, 10).map((points, index) => (
            <li key={index} className={index === 0 ? styles.first : undefined}>{points}</li>
          ))}
        </ol>
        <p className={styles.small}>… až 1 bod za 30. místo a dál.</p>
      </InfoPanel>

      <InfoPanel icon="globe" title="Zveřejnění na jmlp.cz">
        <p>
          Na web jde jen celková výsledková listina. Tlačítko Publikovat ji vygeneruje do náhledu a teprve tam ji
          publikujete – nahradí listinu, která je u závodu na webu.
        </p>
        {queueTotal > 0 && (
          <Alert type="warning" compact>
            Než budete publikovat, odešlete frontu – {queueTotal} změn je zatím jen v tomhle notebooku.
            {' '}<Link to="/timekeeper/sync">Otevřít synchronizaci</Link>
          </Alert>
        )}
      </InfoPanel>

      <InfoPanel
        icon="chart"
        title="Pořadí poháru"
        aside={race?.season_id ? `Sezóna ${formatSeasonShort(race.season_id)}` : null}
      >
        <p>
          Pohár průběžně i celkově spočítá server ze všech závodů sezóny, které mají výsledky v aplikaci.
          Pořadí se otevře v náhledu a odtud se zveřejní u sezóny – nahradí dosavadní průběžné nebo celkové
          výsledky. Celkově až po skončení sezóny.
        </p>
      </InfoPanel>
    </div>
  );
}
