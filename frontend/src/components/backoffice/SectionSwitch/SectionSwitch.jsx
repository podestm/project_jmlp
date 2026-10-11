import { Link } from 'react-router-dom';
import { Icon } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import styles from './SectionSwitch.module.css';

const SECTIONS = [
  { key: 'admin', to: '/admin', icon: 'gear', label: 'Admin' },
  { key: 'timekeeper', to: '/timekeeper', icon: 'stopwatch', label: 'Časomíra' },
];

/**
 * Přepínač Admin / Časomíra na navy ploše (TkPrehled „Přihlášený v roli
 * Admin“, postranní panel a mobilní menu administrace). Jen pro roli admin – časoměřiče server do
 * administrace nepustí. Přihlášení je společné, takže přepnutí je bez
 * nového přihlášení.
 * - current: sekce, ve které uživatel je
 * - block: na celou šířku (mobilní menu)
 * - compact: pod 1440 px jen ikony (lišta časomíry)
 */
export default function SectionSwitch({ current, block = false, compact = false, onNavigate, className }) {
  return (
    <nav aria-label="Přepnutí sekce" className={cx(styles.switch, block && styles.block, compact && styles.compact, className)}>
      {SECTIONS.map((section) => {
        const content = (
          <>
            <Icon name={section.icon} size={16} />
            <span className={styles.label}>{section.label}</span>
          </>
        );
        return section.key === current ? (
          <span key={section.key} className={cx(styles.option, styles.active)} aria-current="true">{content}</span>
        ) : (
          <Link
            key={section.key}
            to={section.to}
            className={styles.option}
            title={`Přepnout do sekce ${section.label}`}
            onClick={onNavigate}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
