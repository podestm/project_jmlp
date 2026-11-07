import { forwardRef } from 'react';
import { cx } from '../cx.js';
import Icon from '../Icon/Icon.jsx';
import styles from './IconButton.module.css';

/**
 * Tlačítko jen s ikonou (44 × 44 px). `label` je povinný – stane se
 * přístupným jménem (aria-label); bez něj by tlačítko bylo pro čtečku prázdné.
 * - variant: outline | quiet | primary | danger | on-dark (na navy ploše)
 */
const IconButton = forwardRef(function IconButton(
  { icon, label, variant = 'outline', size = 'md', iconSize = 20, type = 'button', className, ...rest },
  ref,
) {
  if (!label && import.meta.env.DEV) throw new Error(`IconButton „${icon}“ nemá label`);
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cx(styles.iconButton, styles[variant], styles[size], className)}
      {...rest}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
});

export default IconButton;
