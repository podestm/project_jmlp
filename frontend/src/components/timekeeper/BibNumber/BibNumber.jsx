import { cx } from '../../ms/cx.js';
import { setColorVar } from '../../../utils/raceNumbers.js';
import styles from './BibNumber.module.css';

/**
 * Číslo dresu (TkZavodnici, TkStartovniListina, zadávání časů, výsledky):
 * box vyplněný barvou sady – skutečnou barvou dresu – s bílým tučným číslem
 * v Plex Mono. Venku na slunci tenká lišta nebyla vidět; všechny sady
 * (--ms-bib-*) mají s bílou kontrast nad 5 : 1. Bez čísla pomlčka.
 *
 * Systémové označení (B12) se nevypisuje – sadu ukazuje barva; označení je
 * jen v bublině po najetí (`code`).
 *
 * @param {string} [code] systémové označení čísla (B12)
 * @param {boolean} plain dres zatím nepatří žádnému závodníkovi (schránka
 *   impulzů) – neutrální box, ať barva nenaznačuje sadu, kterou nikdo nezná
 */
export default function BibNumber({ number, setColor, code, size = 'md', plain = false, className }) {
  if (number == null || number === '') {
    return <span className={cx(styles.empty, className)}>—</span>;
  }
  return (
    <span
      className={cx(styles.bib, styles[size], plain && styles.plain, className)}
      style={plain ? undefined : { '--bib-color': setColorVar(setColor) }}
      title={code || undefined}
    >
      {number}
    </span>
  );
}
