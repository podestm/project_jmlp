import { useEffect, useRef, useState } from 'react';
import CloseButton from '../CloseButton/CloseButton.jsx';
import { cx } from '../cx.js';
import Icon from '../Icon/Icon.jsx';
import styles from './Alert.module.css';

const ICON = { danger: 'error', warning: 'warning', success: 'success', info: 'info' };

/**
 * Hláška (StavyVerejnehoWebu): bílá karta s 4px lištou vlevo v barvě
 * závažnosti, ikona, nadpis, text a akce. Závažnost nese i text a role:
 * chyba (danger) má role="alert", ostatní role="status".
 * - type: danger | warning | success | info (stejné názvy jako ui/Alert)
 * - úspěch po 3 s sám zmizí a odmontuje se (autoDismissDelay přebije; 0 = zůstane)
 * - onDismiss: zobrazí křížek „Zavřít hlášku“ a zavolá se i po samovolném zmizení
 * - compact: menší odsazení a nadpis (administrace, časomíra)
 */
export default function Alert({
  type = 'info',
  title,
  children,
  actions,
  onDismiss,
  autoDismissDelay,
  compact = false,
  className,
}) {
  const [visible, setVisible] = useState(true);
  // V refu, aby nová inline funkce od rodiče nerestartovala odpočet.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const delay = autoDismissDelay ?? (type === 'success' ? 3000 : 0);

  useEffect(() => {
    if (delay <= 0) return undefined;
    const timer = setTimeout(() => {
      setVisible(false);
      onDismissRef.current?.();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    onDismissRef.current?.();
  };

  return (
    <div
      role={type === 'danger' ? 'alert' : 'status'}
      className={cx(styles.alert, styles[type], compact && styles.compact, className)}
    >
      <Icon name={ICON[type]} size={compact ? 20 : 22} className={styles.icon} />
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.text}>{children}</div>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {onDismiss && <CloseButton label="Zavřít hlášku" onClick={dismiss} />}
    </div>
  );
}
