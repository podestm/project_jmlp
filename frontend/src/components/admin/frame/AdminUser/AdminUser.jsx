import { Button } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import { initialsOf } from '../../../backoffice/user.js';
import styles from './AdminUser.module.css';

/** Přihlášený správce a odhlášení (konec postranního panelu i mobilního menu). */
export default function AdminUser({ admin, onLogout, className }) {
  const name = admin?.full_name || admin?.email || '';
  return (
    <div className={cx(styles.user, className)}>
      <div className={styles.who}>
        <span className={styles.avatar} aria-hidden="true">{initialsOf(name)}</span>
        <span className={styles.name}>{name}</span>
      </div>
      <Button variant="on-dark" size="sm" icon="logout" block onClick={onLogout}>Odhlásit se</Button>
    </div>
  );
}
