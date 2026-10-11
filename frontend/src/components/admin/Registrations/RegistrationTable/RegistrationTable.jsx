import { Fragment } from 'react';
import { Badge, Table, TableScroll } from '../../../ms/index.js';
import { clubLabel, formatRegisteredAt, isWaitingForClub, racerName, sexLabel } from '../registrations.js';
import styles from './RegistrationTable.module.css';

/**
 * Tabulka přihlášek (AdminPrihlasky, od 768 px). Skupiny podle klubu mají
 * řádek s názvem a počtem; při řazení podle příjmení je klub sloupcem.
 */
export default function RegistrationTable({ groups }) {
  const showClub = groups.some((group) => !group.label);
  const columns = showClub ? 6 : 5;

  return (
    <TableScroll label="Přihlášení závodníci" className={styles.wrap}>
      <Table caption="Přihlášení závodníci">
        <thead>
          <tr>
            <th scope="col">Závodník</th>
            <th scope="col" className={styles.narrow}>Ročník</th>
            <th scope="col" className={styles.narrow}>Pohlaví</th>
            <th scope="col" className={styles.narrow}>SLČR</th>
            {showClub && <th scope="col">Klub</th>}
            <th scope="col" data-align="end">Přihlášen</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.key}>
              {group.label && (
                <tr className={styles.group}>
                  <th scope="colgroup" colSpan={columns}>
                    <span className={styles.groupName}>{group.label}</span>
                    <span className={styles.groupCount}>{group.items.length}</span>
                  </th>
                </tr>
              )}
              {group.items.map((registration) => {
                const waiting = isWaitingForClub(registration);
                return (
                  <tr key={registration.registration_id} data-state={waiting ? 'warning' : undefined}>
                    <td>
                      <span className={styles.name}>
                        <strong>{racerName(registration)}</strong>
                        {waiting && <Badge tone="dry" size="sm">Čeká na klub</Badge>}
                      </span>
                    </td>
                    <td data-numeric>{registration.birthYear}</td>
                    <td>{sexLabel(registration.sex) && <Badge size="sm">{sexLabel(registration.sex)}</Badge>}</td>
                    <td className={styles.mono}>{registration.idSlcr || '–'}</td>
                    {showClub && <td>{clubLabel(registration.club_name)}</td>}
                    <td data-align="end" className={styles.mono}>{formatRegisteredAt(registration.registration_date)}</td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </Table>
    </TableScroll>
  );
}
