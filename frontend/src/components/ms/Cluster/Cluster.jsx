import { cx } from '../cx.js';
import { gapStyle } from '../space.js';
import styles from './Cluster.module.css';

/**
 * Řada prvků se zalomením a mezerou `gap` (tlačítka, filtry, odznaky).
 * align: center (výchozí) | start | baseline | end; justify: start | between | end
 */
export default function Cluster({ as: Tag = 'div', gap = 3, align = 'center', justify = 'start', wrap = true, className, children, ...rest }) {
  return (
    <Tag
      className={cx(styles.cluster, styles[`align-${align}`], styles[`justify-${justify}`], !wrap && styles.nowrap, className)}
      style={gapStyle(gap)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
