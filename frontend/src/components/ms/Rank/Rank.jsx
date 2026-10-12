import { cx } from '../cx.js';
import styles from './Rank.module.css';

/**
 * Pořadí ve výsledcích (design systém Rank): šedý čtvereček s číslem v Plex
 * Mono, pódium – 1. místo teplý akcent ms-sun, 2.–3. plné navy. Bez pořadí
 * (DNF, nehodnocen) pomlčka.
 * - size: md (30 px, veřejný web) | lg (34 px, časomíra)
 */
export default function Rank({ place, size = 'md', className }) {
  const podium = place >= 1 && place <= 3 ? String(place) : undefined;
  return (
    <span className={cx(styles.rank, styles[size], className)} data-podium={podium}>
      {place ?? '—'}
    </span>
  );
}
