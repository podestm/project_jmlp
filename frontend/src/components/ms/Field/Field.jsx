import { Children, cloneElement, isValidElement, useId } from 'react';
import { cx } from '../cx.js';
import Icon from '../Icon/Icon.jsx';
import styles from './Field.module.css';

/**
 * Popisek + ovládací prvek + nápověda + chyba, správně provázané:
 * label[for] ↔ id, aria-describedby (nápověda, chyba), aria-invalid, required.
 * Chyba se vykreslí jen tehdy, když je (text v --ms-live-ink s ikonou).
 *
 * Potomek je jeden prvek (Input/Select/Textarea), kterému Field doplní
 * atributy, nebo funkce, která je dostane: {(props) => <Input {...props} />}.
 */
/** Atributy z Field mají přednost; vlastní aria-describedby potomka se zachová. */
const mergeControlProps = (own, fromField) => ({
  ...fromField,
  required: own.required || fromField.required,
  'aria-describedby':
    [own['aria-describedby'], fromField['aria-describedby']].filter(Boolean).join(' ') || undefined,
});

export default function Field({
  label,
  hint,
  error,
  required = false,
  id: idProp,
  className,
  children,
}) {
  const autoId = useId();
  const id = idProp ?? `f${autoId}`;
  const hintId = hint ? `${id}-napoveda` : undefined;
  const errorId = error ? `${id}-chyba` : undefined;

  const controlProps = {
    id,
    required: required || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
  };

  let control;
  if (typeof children === 'function') {
    control = children(controlProps);
  } else {
    const child = Children.only(children);
    control = isValidElement(child)
      ? cloneElement(child, mergeControlProps(child.props, controlProps))
      : child;
  }

  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {control}
      {hint && (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className={styles.error}>
          <Icon name="error" size={18} />
          <span>{error}</span>
        </span>
      )}
    </div>
  );
}
