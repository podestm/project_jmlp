import { Alert } from '../ms/index.js';
import styles from './TimekeeperMessage.module.css';

/**
 * Hláška časomíry nad obsahem obrazovky (kit Alert, kompaktní). Na rozdíl od
 * administrace nemizí sama: časoměřič ji zavře křížkem, až ji přečte.
 *
 * @param {{type: 'success'|'danger'|'warning'|'info', text: React.ReactNode}|null} message
 * @param {() => void} onDismiss
 */
export default function TimekeeperMessage({ message, onDismiss }) {
  if (!message) return null;
  return (
    <Alert type={message.type} compact autoDismissDelay={0} onDismiss={onDismiss} className={styles.message}>
      {message.text}
    </Alert>
  );
}
