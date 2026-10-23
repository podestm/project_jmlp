import { Icon, IconButton, Table, TableScroll } from '../../../ms/index.js';
import StatBox from '../StatBox/StatBox.jsx';
import styles from './RecalculateSummary.module.css';

const sexWord = (sex) => (sex === 1 ? 'Muž' : sex === 2 ? 'Žena' : 'Mix');

/**
 * Výsledek hromadného přepočtu kategorií závodníků (karta na stránce po
 * AdminDialogPrepocetKategorii). Seznam `updates` vrací backend jen když
 * závodníkům skutečně přeřadil kategorii; souhrn `summary` je tam vždy.
 */
export default function RecalculateSummary({ result, onDismiss }) {
  return (
    <section className={styles.summary} aria-labelledby="prepocet-nadpis">
      <header className={styles.head}>
        <Icon name="check" size={22} className={styles.icon} />
        <h3 id="prepocet-nadpis" className={styles.title}>Přepočet kategorií dokončen</h3>
        <IconButton icon="close" variant="quiet" label="Skrýt výsledky" onClick={onDismiss} className={styles.close} />
      </header>

      {result.summary && (
        <div className={styles.stats}>
          <StatBox label="Celkem" value={result.summary.total_racers || 0} />
          <StatBox label="Změněno" value={result.summary.updated_racers || 0} />
          <StatBox label="Beze změny" value={result.summary.unchanged_racers || 0} tone="open" />
        </div>
      )}

      {result.updates?.length > 0 && (
        <TableScroll label="Aktualizovaní závodníci" className={styles.updates}>
          <Table caption={`Aktualizováno ${result.updates.length} závodníků`} density="compact" stickyHeader>
            <thead>
              <tr>
                <th scope="col">Závodník</th>
                <th scope="col">Ročník</th>
                <th scope="col">Pohlaví</th>
                <th scope="col">Změna kategorie</th>
              </tr>
            </thead>
            <tbody>
              {result.updates.map((update, idx) => (
                <tr key={idx}>
                  <td className={styles.name}>{update.name}</td>
                  <td data-numeric>{update.birth_year}</td>
                  <td>{sexWord(update.sex)}</td>
                  <td>
                    <span className={styles.change}>
                      <span className={styles.old}>{update.old_category}</span>
                      <Icon name="arrow-right" size={16} />
                      <strong>{update.new_category}</strong>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      )}
    </section>
  );
}
