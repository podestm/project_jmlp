import { forwardRef } from 'react';
import { cx } from '../cx.js';
import Icon from '../Icon/Icon.jsx';
import Spinner from '../Spinner/Spinner.jsx';
import styles from './Button.module.css';

/** Třídy tlačítka – sdílí je Button a ButtonLink, aby vypadaly stejně. */
export const buttonClassName = ({
  variant = 'outline',
  size = 'md',
  block = false,
  className,
} = {}) => cx(styles.button, styles[variant], styles[size], block && styles.block, className);

/**
 * Obsah tlačítka: volitelná ikona vlevo (nebo spinner při `busy`), text
 * a volitelná ikona vpravo (`iconEnd`, typicky šipka „pokračovat“).
 */
export const ButtonContent = ({ icon, iconEnd, busy, children }) => (
  <>
    {busy ? <Spinner size={18} tone="current" /> : icon && <Icon name={icon} size={18} />}
    <span>{children}</span>
    {iconEnd && <Icon name={iconEnd} size={18} />}
  </>
);

/**
 * Tlačítko Modré stopy (BRIEF: jedna plná primární akce na sekci, ostatní obrysové).
 * - variant: primary | outline | danger | quiet | open (vratná kladná akce, zelená)
 *   | on-dark | inverse | accent (tři poslední na navy ploše; accent = teplý
 *   akcent, nejvýš jedno na obrazovku)
 * - size: sm (44 px) | md (48 px) | lg (52 px)
 * - icon / iconEnd: ikona před textem / za textem
 * - busy: probíhá akce – spinner místo ikony, aria-busy a tlačítko nejde znovu
 *   odeslat (proti dvojímu odeslání), text zůstává
 */
const Button = forwardRef(function Button(
  {
    variant = 'outline',
    size = 'md',
    block = false,
    icon,
    iconEnd,
    busy = false,
    disabled,
    type = 'button',
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName({ variant, size, block, className })}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-busy={busy || undefined}
      {...rest}
    >
      <ButtonContent icon={icon} iconEnd={iconEnd} busy={busy}>
        {children}
      </ButtonContent>
    </button>
  );
});

export default Button;
