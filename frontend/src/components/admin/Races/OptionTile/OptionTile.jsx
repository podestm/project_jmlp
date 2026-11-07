import { Checkbox } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import styles from './OptionTile.module.css';

/**
 * Zaškrtávací volba formuláře závodu v podbarvené dlaždici. tone="open"
 * přidá zelenou lištu, když je zaškrtnuto (Povolit registrace).
 */
export default function OptionTile({ tone, className, ...checkboxProps }) {
  return (
    <div
      className={cx(styles.tile, className)}
      data-tone={tone}
      data-checked={checkboxProps.checked || undefined}
    >
      <Checkbox {...checkboxProps} />
    </div>
  );
}
