import { EmptyState, Table, TableScroll } from '../../../ms/index.js';
import { whenParts } from '../dashboard.js';
import styles from './RecentRegistrations.module.css';

const When = ({ iso }) => {
  const { day, time } = whenParts(iso);
  return <>{day} <span className={styles.time}>{time}</span></>;
};

/**
 * Poslední přihlášky (AdminDashboard tabulka, AdminMobilPrehled řádky).
 * Na mobilu místo tabulky seznam: jméno, klub · závod, kdy.
 */
export default function RecentRegistrations({ registrations }) {
  if (registrations.length === 0) {
    return <EmptyState icon="user" title="Žádné registrace" headingLevel={3} />;
  }

  return (
    <>
      <TableScroll label="Poslední přihlášky" className={styles.table}>
        <Table caption="Poslední přihlášky">
          <thead>
            <tr>
              <th scope="col">Závodník</th>
              <th scope="col">Klub</th>
              <th scope="col">Závod</th>
              <th scope="col" data-align="end">Přihlášen</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((reg, index) => (
              <tr key={`${reg.registered_at}-${index}`}>
                <td className={styles.name}>{reg.racer_surname} {reg.racer_name}</td>
                <td>{reg.club_name || '—'}</td>
                <td>
                  <span className={styles.race}>{reg.race_nr || '?'}</span>
                  {reg.areal_name && <span className={styles.areal}> · {reg.areal_name}</span>}
                </td>
                <td data-align="end" className={styles.when}><When iso={reg.registered_at} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableScroll>

      <ul className={styles.list} aria-label="Poslední přihlášky">
        {registrations.map((reg, index) => (
          <li key={`${reg.registered_at}-${index}`} className={styles.item}>
            <span className={styles.itemText}>
              <span className={styles.name}>{reg.racer_surname} {reg.racer_name}</span>
              <span className={styles.meta}>
                {[reg.club_name, reg.race_nr].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className={styles.when}><When iso={reg.registered_at} /></span>
          </li>
        ))}
      </ul>
    </>
  );
}
