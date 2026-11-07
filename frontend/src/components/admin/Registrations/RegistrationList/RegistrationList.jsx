import { Badge, VisuallyHidden } from '../../../ms/index.js';
import {
  clubLabel,
  formatRegisteredAt,
  isWaitingForClub,
  racerName,
  sexLabel,
} from '../registrations.js';
import styles from './RegistrationList.module.css';

/** Řádek závodníka: ročník v boxu, jméno a pod ním údaje přihlášky. */
function RegistrationRow({ registration, showClub }) {
  const waiting = isWaitingForClub(registration);
  const details = [
    showClub && clubLabel(registration.club_name),
    sexLabel(registration.sex),
    registration.category_name,
    registration.idSlcr && `SLČR ${registration.idSlcr}`,
    formatRegisteredAt(registration.registration_date),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className={styles.row} data-waiting={waiting || undefined}>
      <span className={styles.year}>
        <VisuallyHidden>ročník </VisuallyHidden>
        {registration.birthYear}
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{racerName(registration)}</span>
        <span className={styles.details}>{details}</span>
      </span>
      {waiting && (
        <Badge tone="dry" size="sm">
          Čeká na klub
        </Badge>
      )}
      {!waiting && !registration.idSlcr && <Badge size="sm">Bez SLČR</Badge>}
    </li>
  );
}

/** Přihlášky jako seznam po skupinách (AdminMobilPrihlasky, pod 768 px). */
export default function RegistrationList({ groups }) {
  return (
    <div className={styles.list}>
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label ?? 'Přihlášení závodníci'}>
          {group.label && (
            <div className={styles.head}>
              <h2 className={styles.title}>{group.label}</h2>
              <span className={styles.count}>{group.items.length}</span>
            </div>
          )}
          <ul className={styles.rows}>
            {group.items.map((registration) => (
              <RegistrationRow
                key={registration.registration_id}
                registration={registration}
                showClub={!group.label}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
