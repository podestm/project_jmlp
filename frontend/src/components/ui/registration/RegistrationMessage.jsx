import { Alert } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import styles from './RegistrationMessage.module.css';

/**
 * Hláška registračního formuláře (kit Alert). Nemizí sama – výsledek
 * přihlášky musí zůstat vidět, dokud ho člověk nezavře.
 *
 * @param {{type: 'success'|'danger'|'info', text: string}|null} message - z useRegistration
 * @param {() => void} onDismiss
 */
export default function RegistrationMessage({ message, onDismiss }) {
  if (!message) return null;
  return (
    <Alert type={message.type} autoDismissDelay={0} onDismiss={onDismiss} className={cx('ms-scope', styles.message)}>
      {message.text}
    </Alert>
  );
}
