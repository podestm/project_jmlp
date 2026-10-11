import { forwardRef } from 'react';
import { cx } from '../cx.js';
import Icon from '../Icon/Icon.jsx';
import styles from './CloseButton.module.css';

/**
 * Křížek 44 × 44 px. Popisek říká, co zavírá („Zavřít dialog“, „Zavřít
 * hlášku“), aby se nepletl s tlačítkem Zrušit.
 */
const CloseButton = forwardRef(function CloseButton({ label = 'Zavřít', className, ...rest }, ref) {
  return (
    <button ref={ref} type="button" aria-label={label} className={cx(styles.close, className)} {...rest}>
      <Icon name="x" size={20} strokeWidth={2.2} />
    </button>
  );
});

export default CloseButton;
