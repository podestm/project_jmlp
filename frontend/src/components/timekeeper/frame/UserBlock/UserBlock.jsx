import { IconButton } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import { initialsOf, roleLabel } from '../user.js';
import styles from './UserBlock.module.css';

/**
 * Kdo je přihlášený a odhlášení (konec lišty sekce). Pod 1280 px zůstane
 * jen iniciála a tlačítko.
 */
export default function UserBlock({ user, onLogout, className }) {
  const name = user?.full_name || user?.email || '';
  return (
    <div className={cx(styles.user, className)}>
      <span className={styles.avatar} aria-hidden="true">{initialsOf(name)}</span>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        <span className={styles.role}>{roleLabel(user?.role)}</span>
      </span>
      <IconButton icon="logout" label="Odhlásit se" variant="on-dark" iconSize={18} onClick={onLogout} />
    </div>
  );
}
