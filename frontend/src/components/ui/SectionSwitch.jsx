import { Link } from 'react-router-dom';

/**
 * Přepínač Admin / Časomíra dole v menu obou sekcí, nad přihlášeným
 * uživatelem. V obou sekcích vypadá stejně, liší se jen tím, která polovina
 * je zapnutá (barvy v admin.css, .section-switch).
 *
 * Každá sekce má dál vlastní přihlášení - kdo v té druhé přihlášený není,
 * uvidí po přepnutí její přihlašovací obrazovku.
 */
const SECTIONS = [
  { key: 'admin', to: '/admin', icon: 'bi-gear-fill', label: 'Admin' },
  { key: 'timekeeper', to: '/timekeeper', icon: 'bi-stopwatch-fill', label: 'Časomíra' }
];

/** @param {{ current: 'admin' | 'timekeeper' }} props sekce, ve které uživatel je */
export default function SectionSwitch({ current }) {
  return (
    <nav className="section-switch" aria-label="Přepnutí sekce">
      {SECTIONS.map((section) => {
        const content = (
          <>
            <i className={`bi ${section.icon}`} aria-hidden="true"></i>
            <span className="section-switch-label">{section.label}</span>
          </>
        );
        const className = `section-switch-option is-${section.key}`;

        return section.key === current ? (
          <span key={section.key} className={`${className} is-active`} aria-current="true">
            {content}
          </span>
        ) : (
          <Link key={section.key} to={section.to} className={className} title={`Přepnout do sekce ${section.label}`}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
