import { Alert as MsAlert } from '../ms/index.js';
import { cx } from '../ms/cx.js';
import styles from './Alert.module.css';

const noop = () => {};

/**
 * Hláška pro obrazovky, které ještě nejsou převedené na Modrou stopu
 * (administrace, přihlášení). Vykreslí kit Alert v kompaktní velikosti;
 * kořen má .ms-scope, aby ve starém okolí platil reset a písma nového UI.
 *
 * API zůstává jako dřív:
 * @param {'success'|'danger'|'warning'|'info'} type
 * @param {React.ReactNode} message - obsah; bez něj se nic nevykreslí
 * @param {function} [onDismiss] - po zavření křížkem i po samovolném zmizení
 * @param {number} [autoDismissDelay] - ms do zmizení (0 = zůstane); výchozí:
 *   chyba zůstane, ostatní zmizí po 3 s
 *
 * Odpočet se při změně zprávy nerestartuje – kdo to chce, dá prvku `key`
 * odvozený ze zprávy (volající často posílají pokaždé nový JSX prvek).
 */
export default function Alert({ type = 'info', message, onDismiss, autoDismissDelay = null }) {
  if (!message) return null;
  const delay = autoDismissDelay ?? (type === 'danger' ? 0 : 3000);
  return (
    <MsAlert type={type} compact autoDismissDelay={delay} onDismiss={onDismiss ?? noop} className={cx('ms-scope', styles.legacyGap)}>
      {message}
    </MsAlert>
  );
}
