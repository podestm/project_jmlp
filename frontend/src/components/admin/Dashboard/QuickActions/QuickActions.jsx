import { ButtonLink } from '../../../ms/index.js';
import styles from './QuickActions.module.css';

/** Rychlé akce (AdminDashboard): zkratky na časté obrazovky a veřejný web. */
export default function QuickActions() {
  return (
    <div className={styles.actions}>
      <ButtonLink to="/admin/racers" size="sm" icon="user-plus" block className={styles.action}>Přidat závodníka</ButtonLink>
      <ButtonLink to="/admin/posts" size="sm" icon="news" block className={styles.action}>Napsat aktualitu</ButtonLink>
      <ButtonLink to="/admin/documents" size="sm" icon="file" block className={styles.action}>Otevřít knihovnu dokumentů</ButtonLink>
      <ButtonLink to="/admin/club-requests" size="sm" icon="home" block className={styles.action}>Vyřídit žádosti o kluby</ButtonLink>
      <ButtonLink href="/" target="_blank" rel="noreferrer" size="sm" icon="external-link" block className={styles.action}>
        Otevřít veřejný web
      </ButtonLink>
    </div>
  );
}
