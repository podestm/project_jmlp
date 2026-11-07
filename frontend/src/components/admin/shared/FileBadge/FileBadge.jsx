import { cx } from '../../../ms/cx.js';
import { getExtensionLabel, getExtensionTone } from '../../../../utils/files.js';
import styles from './FileBadge.module.css';

/**
 * Štítek přípony souboru („PDF“, „JPG“) před názvem v knihovně, přílohách
 * a výběru z knihovny. Barva písma podle druhu souboru jen podtrhuje text.
 */
export default function FileBadge({ filename, className }) {
  return (
    <span className={cx(styles.badge, styles[getExtensionTone(filename)], className)}>
      {getExtensionLabel(filename)}
    </span>
  );
}
