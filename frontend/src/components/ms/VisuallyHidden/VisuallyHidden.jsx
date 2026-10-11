import { cx } from '../cx.js';

/**
 * Text jen pro čtečky. `focusable` se ukáže při fokusu z klávesnice
 * (např. odkaz „Přeskočit na obsah“). Třídy .ms-sr-only jsou v base.css.
 */
export default function VisuallyHidden({ as: Tag = 'span', focusable = false, className, children, ...rest }) {
  return (
    <Tag className={cx('ms-sr-only', focusable && 'ms-sr-only--focusable', className)} {...rest}>
      {children}
    </Tag>
  );
}
