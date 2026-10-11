import { cx } from '../cx.js';
import { ICONS } from './icons.js';
import styles from './Icon.module.css';

const SHAPES = { path: 'path', circle: 'circle', rect: 'rect', line: 'line', polyline: 'polyline', polygon: 'polygon', ellipse: 'ellipse' };

/** Tloušťka tahu: výslovná > nakreslená pro tuto velikost > výchozí ikony. */
const resolveStroke = (icon, size, override) => override ?? (typeof size === 'number' ? icon.sizes?.[size] : undefined) ?? icon.strokeWidth;

/**
 * Ikona Modré stopy: vložené stroke SVG s geometrií z artboardů (icons.js).
 * Vždy dekorativní (aria-hidden) – význam nese text vedle ní, u ikonového
 * tlačítka jeho `label` (IconButton). Barva je currentColor.
 * Velikost 1em se řídí písmem okolí; `size` ji přebije v px. `style` jen pro
 * staré obrazovky (velikost písma, barva) – v kitu se nepoužívá.
 */
export default function Icon({ name, size, strokeWidth, className, style }) {
  const icon = ICONS[name];
  if (!icon) {
    if (import.meta.env.DEV) throw new Error(`Neznámá ikona „${name}“ – přidej ji do components/ms/Icon/icons.js`);
    return null;
  }
  const dimension = size ?? '1em';
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={resolveStroke(icon, size, strokeWidth)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx(styles.icon, className)}
      style={style}
    >
      {icon.paths.map(({ tag, ...attrs }, index) => {
        const Shape = SHAPES[tag];
        // Pořadí tvarů je pevné, index je stabilní klíč.
        return <Shape key={index} {...attrs} />;
      })}
    </svg>
  );
}
