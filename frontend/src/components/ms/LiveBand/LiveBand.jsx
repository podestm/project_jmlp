import { Link } from 'react-router-dom';
import Container from '../Container/Container.jsx';
import Icon from '../Icon/Icon.jsx';
import styles from './LiveBand.module.css';

/**
 * Červený pruh přes celou šířku pod hlavičkou, jen když právě běží závod
 * (design systém LiveBand). Celý je odkaz na živé výsledky.
 */
export default function LiveBand({ title, detail, action = 'Živé výsledky', to = '/zive' }) {
  return (
    <Link to={to} className={styles.band}>
      <Container className={styles.inner}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.text}>
          <strong className={styles.title}>{title}</strong>
          {detail && <span>{detail}</span>}
        </span>
        <span className={styles.action}>
          {action} <Icon name="arrow-right" size={18} />
        </span>
      </Container>
    </Link>
  );
}
