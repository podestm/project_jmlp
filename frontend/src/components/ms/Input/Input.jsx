import { forwardRef } from 'react';
import { cx } from '../cx.js';
import styles from './Input.module.css';

/**
 * Nativní textové pole. size: sm (44 px, administrace) | md (48 px) | lg (52 px, přihláška).
 * Chybu kreslí podle aria-invalid (nastaví ji Field). Číselné hodnoty: mono.
 */
const Input = forwardRef(function Input(
  { size = 'md', mono = false, type = 'text', className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cx(styles.input, styles[size], mono && styles.mono, className)}
      {...rest}
    />
  );
});

export default Input;
