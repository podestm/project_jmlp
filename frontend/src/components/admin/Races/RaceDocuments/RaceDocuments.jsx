import { Icon, VisuallyHidden } from '../../../ms/index.js';
import styles from './RaceDocuments.module.css';

/**
 * Dokumenty závodu v řádku seznamu. Odkazy míří na veřejné trvalé adresy
 * závodu, ne na konkrétní soubor – po výměně přílohy zůstávají platné.
 */
export default function RaceDocuments({ race }) {
  const links = [
    race.proposition_file_id && { href: `/races/${race.id}/proposition`, label: 'Propozice' },
    race.results_file_id && { href: `/races/${race.id}/results`, label: 'Výsledky' },
  ].filter(Boolean);

  if (links.length === 0)
    return (
      <span className={styles.none}>
        —<VisuallyHidden> bez dokumentů</VisuallyHidden>
      </span>
    );

  return (
    <span className={styles.links}>
      {links.map(({ href, label }) => (
        <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={styles.link}>
          <Icon name="file-text" size={16} />
          {label}
        </a>
      ))}
    </span>
  );
}
