import { forwardRef } from 'react';
import { cx } from '../cx.js';
import styles from './Textarea.module.css';

/** Nativní víceřádkové pole; chybu kreslí podle aria-invalid. */
const Textarea = forwardRef(function Textarea({ rows = 4, className, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cx(styles.textarea, className)} {...rest} />;
});

export default Textarea;
