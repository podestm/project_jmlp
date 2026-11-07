import styles from './SlcrName.module.css';

/**
 * Jméno závodníka jako odkaz na kartu člena v evidenci SLČR, když je závodník
 * propojený (sedí ID závodníka, nebo přesně jméno a ročník – viz backend
 * services/slcr_links.py). Jinak jen text.
 */
export default function SlcrName({ racer, children }) {
  if (!racer.slcr_url) return children;
  return (
    <a
      href={racer.slcr_url}
      target="_blank"
      rel="noopener noreferrer"
      title="Karta člena v evidenci SLČR"
      className={styles.link}
    >
      {children}
    </a>
  );
}
