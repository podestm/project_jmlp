import { Alert, Button, ButtonLink } from '../../../ms/index.js';
import styles from './DashboardError.module.css';

/**
 * Přehled se nenačetl (AdminPrehledChyba). Hláška nemá křížek – zavřít ji
 * by znamenalo zůstat bez dat; jde jen zkusit znovu nebo odejít jinam.
 */
export default function DashboardError({ message, onRetry }) {
  return (
    <Alert
      type="danger"
      title="Přehled se teď nepodařilo načíst"
      actions={(
        <>
          <Button variant="primary" size="sm" icon="refresh" onClick={onRetry}>Zkusit načíst znovu</Button>
          <ButtonLink to="/admin/races" size="sm">Přejít na Závody</ButtonLink>
          <ButtonLink to="/admin/club-requests" size="sm">Přejít na Žádosti o kluby</ButtonLink>
        </>
      )}
    >
      <p className={styles.text}>Server neodpověděl. Data jsou v pořádku.</p>
      {message && <p className={styles.detail}><span className={styles.detailLabel}>Pro správce webu:</span> {message}</p>}
    </Alert>
  );
}
