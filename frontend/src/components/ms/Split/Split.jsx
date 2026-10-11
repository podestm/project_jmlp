import { cx } from '../cx.js';
import { spaceVar } from '../space.js';
import styles from './Split.module.css';

/**
 * Dva sloupce vedle sebe (filtry + výpis, tabulka + schránka). `columns` je
 * grid-template-columns, např. "320px minmax(0, 1fr)". Pod `stackBelow`
 * (768 | 1024 | 1280) se složí pod sebe; `reverse` pak dá druhý sloupec
 * nahoru (místo Bootstrap order-*).
 */
export default function Split({
  as: Tag = 'div', columns = 'minmax(0, 1fr) minmax(0, 1fr)', gap = 10, stackBelow = 1024, reverse = false,
  align = 'start', className, children, ...rest
}) {
  return (
    <Tag
      className={cx(styles.split, styles[`below${stackBelow}`], reverse && styles.reverse, styles[`align-${align}`], className)}
      style={{ '--split-columns': columns, '--gap': spaceVar(gap) }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
