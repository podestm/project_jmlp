import { Link } from 'react-router-dom';
import { Icon } from '../../../ms/index.js';
import styles from './ClubRequestsBanner.module.css';

const heading = (count) => {
  if (count === 1) return '1 nevyřízená žádost o přiřazení klubu';
  if (count >= 2 && count <= 4) return `${count} nevyřízené žádosti o přiřazení klubu`;
  return `${count} nevyřízených žádostí o přiřazení klubu`;
};

/** Upozornění na nevyřízené žádosti o kluby (AdminDashboard „Fronta žádostí“). */
export default function ClubRequestsBanner({ count }) {
  return (
    <Link to="/admin/club-requests" className={styles.banner}>
      <Icon name="warning" size={22} className={styles.icon} />
      <span className={styles.text}>
        <span className={styles.title}>{heading(count)}</span>
        <span className={styles.hint}>
          Závodníci se přihlásili s klubem, který není v seznamu. Dokud je nepřiřadíte, nepočítají se jim body.
        </span>
      </span>
      <span className={styles.action}>
        Vyřídit
        <Icon name="arrow-right" size={18} />
      </span>
    </Link>
  );
}
