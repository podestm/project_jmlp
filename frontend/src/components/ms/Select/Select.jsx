import { forwardRef } from 'react';
import { cx } from '../cx.js';
import Icon from '../Icon/Icon.jsx';
import styles from './Select.module.css';

/** Nativní <select> se šipkou z Icon. size: sm (44) | md (48) | lg (52). */
const Select = forwardRef(function Select({ size = 'md', className, children, ...rest }, ref) {
  return (
    <span className={cx(styles.wrap, className)}>
      <select ref={ref} className={cx(styles.select, styles[size])} {...rest}>
        {children}
      </select>
      <Icon name="chevron-down" size={18} className={styles.arrow} />
    </span>
  );
});

export default Select;
