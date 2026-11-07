import { cx } from '../cx.js';
import styles from './Container.module.css';

/** Obsah stránky na šířku 1240 px se stranovým okrajem 16 px (na 390 px od kraje 16 px). */
export default function Container({ as: Tag = 'div', className, children, ...rest }) {
  return <Tag className={cx(styles.container, className)} {...rest}>{children}</Tag>;
}
