import { Link } from 'react-router-dom';
import { Icon } from '../../../ms/index.js';
import { czechPlural } from '../../../../utils/races.js';
import styles from './WaitingClubNotice.module.css';

/** Odkaz na žádosti o kluby, když část přihlášených čeká na přiřazení klubu. */
export default function WaitingClubNotice({ count }) {
  if (!count) return null;
  const verb = czechPlural(count, ['čeká', 'čekají', 'čeká']);
  return (
    <Link to="/admin/club-requests" className={styles.notice}>
      <Icon name="warning" size={20} className={styles.icon} />
      <span className={styles.text}>
        <strong>{count} {czechPlural(count, ['závodník', 'závodníci', 'závodníků'])} {verb} na přiřazení klubu</strong> – vyřídit
      </span>
      <Icon name="chevron-right" size={20} />
    </Link>
  );
}
