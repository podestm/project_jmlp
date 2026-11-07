import { Link } from 'react-router-dom';
import { cx } from '../cx.js';
import VisuallyHidden from '../VisuallyHidden/VisuallyHidden.jsx';
import styles from './LivePill.module.css';

/**
 * Odznak ŽIVĚ v hlavičce veřejného webu (Zavody, Zive, MobilZavody). Je vidět
 * vždy: když se závodí, je červený s pulzující tečkou, jinak šedý obrys
 * („klid“). Stav čte čtečka z textu, ne z barvy. Pod 1024 px (mobilní
 * hlavička) je užší.
 */
export default function LivePill({ to, live = false, className }) {
  return (
    <Link to={to} className={cx(styles.pill, live ? styles.live : styles.calm, className)}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>Živě</span>
      <VisuallyHidden>{live ? ' – právě se závodí' : ' – právě se nezávodí'}</VisuallyHidden>
    </Link>
  );
}
