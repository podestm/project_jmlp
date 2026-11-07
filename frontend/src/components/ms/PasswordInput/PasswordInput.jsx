import { forwardRef, useState } from 'react';
import { cx } from '../cx.js';
import IconButton from '../IconButton/IconButton.jsx';
import Input from '../Input/Input.jsx';
import styles from './PasswordInput.module.css';

/**
 * Pole pro heslo s tlačítkem „Zobrazit heslo“ uvnitř (TkLogin). Atributy od
 * Field (id, aria-*) i ostatní props jdou na <input>; tlačítko má
 * aria-pressed, takže stav nenese jen ikona.
 */
const PasswordInput = forwardRef(function PasswordInput({ size = 'lg', className, ...rest }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <span className={cx(styles.wrap, className)}>
      <Input ref={ref} size={size} type={visible ? 'text' : 'password'} className={styles.input} {...rest} />
      <IconButton
        icon="eye"
        label="Zobrazit heslo"
        variant="quiet"
        className={styles.toggle}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      />
    </span>
  );
});

export default PasswordInput;
