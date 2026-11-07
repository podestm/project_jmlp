import { cx } from '../cx.js';
import { spaceVar } from '../space.js';
import styles from './Grid.module.css';

/**
 * Mřížka karet. Buď `min` (nejmenší šířka sloupce, sloupců je kolik se vejde),
 * nebo `columns` (pevný počet; pod 768 px jeden sloupec, pod 1024 px nejvýš dva).
 */
export default function Grid({
  as: Tag = 'div',
  min,
  columns,
  gap = 5,
  className,
  children,
  ...rest
}) {
  const style = { '--gap': spaceVar(gap) };
  if (min) style['--grid-min'] = min;
  if (columns) style['--grid-columns'] = columns;
  return (
    <Tag
      className={cx(styles.grid, min ? styles.auto : styles.fixed, className)}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  );
}
