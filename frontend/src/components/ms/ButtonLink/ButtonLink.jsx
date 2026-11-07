import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { ButtonContent, buttonClassName } from '../Button/Button.jsx';

/**
 * Odkaz vzhledu tlačítka. Uvnitř aplikace jde přes router (`to`) – žádné
 * načtení celé stránky, takže funguje i offline. Pro externí adresu `href`.
 */
const ButtonLink = forwardRef(function ButtonLink(
  {
    to,
    href,
    variant = 'outline',
    size = 'md',
    block = false,
    icon,
    iconEnd,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = buttonClassName({ variant, size, block, className });
  const content = (
    <ButtonContent icon={icon} iconEnd={iconEnd}>
      {children}
    </ButtonContent>
  );
  if (href !== undefined) {
    return (
      <a ref={ref} href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <Link ref={ref} to={to} className={classes} {...rest}>
      {content}
    </Link>
  );
});

export default ButtonLink;
