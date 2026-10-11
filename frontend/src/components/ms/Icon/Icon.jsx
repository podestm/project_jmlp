import { cx } from '../cx.js';
import { ICONS } from './icons.js';
import styles from './Icon.module.css';

/**
 * Ikona z lucide-react (stroke). Vždy dekorativní (aria-hidden) – význam nese
 * text vedle ní, u ikonového tlačítka jeho `label` (IconButton).
 * Velikost 1em se řídí písmem okolí; `size` ji přebije v px.
 */
export default function Icon({ name, size, strokeWidth = 2, className }) {
  const Component = ICONS[name];
  if (!Component) {
    if (import.meta.env.DEV) throw new Error(`Neznámá ikona „${name}“ – přidej ji do components/ms/Icon/icons.js`);
    return null;
  }
  return (
    <Component
      aria-hidden="true"
      focusable="false"
      size={size ?? '1em'}
      strokeWidth={strokeWidth}
      className={cx(styles.icon, className)}
    />
  );
}
