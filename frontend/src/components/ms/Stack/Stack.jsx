import { cx } from '../cx.js';
import { gapStyle } from '../space.js';
import styles from './Stack.module.css';

/**
 * Svislý sloupec s mezerou `gap` (krok škály --ms-space-N). Nic jiného neumí –
 * odsazení a vzhled patří do modulu obrazovky.
 * align: stretch (výchozí) | start | center | end
 */
export default function Stack({ as: Tag = 'div', gap = 4, align = 'stretch', className, children, ...rest }) {
  return (
    <Tag className={cx(styles.stack, styles[align], className)} style={gapStyle(gap)} {...rest}>
      {children}
    </Tag>
  );
}
