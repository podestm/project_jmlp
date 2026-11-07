import { Children, cloneElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { cx } from '../cx.js';
import styles from './Tooltip.module.css';

const EDGE = 8;

/**
 * Stručná poznámka k funkci tlačítka (2–6 slov): tmavá bublina při najetí
 * myší a při fokusu klávesnicí, zmizí při Escape, odjetí a ztrátě fokusu.
 * Jediné dítě dostane aria-describedby, takže poznámku přečte i čtečka.
 * Obal je span, takže bublina funguje i u zakázaného tlačítka.
 * - placement: bottom (výchozí) | top
 */
export default function Tooltip({ text, placement = 'bottom', children, className }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const bubbleRef = useRef(null);
  const child = Children.only(children);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Bublina se nesmí vysunout za okraj okna (vodorovné posouvání stránky).
  useLayoutEffect(() => {
    if (!open || !bubbleRef.current) return;
    const rect = bubbleRef.current.getBoundingClientRect();
    const left = rect.left - shift;
    const right = rect.right - shift;
    const viewport = document.documentElement.clientWidth || window.innerWidth;
    let next = 0;
    if (right > viewport - EDGE) next = viewport - EDGE - right;
    if (left + next < EDGE) next = EDGE - left;
    if (next !== shift) setShift(next);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!text) return child;

  const describedBy = cx(child.props['aria-describedby'], id);
  return (
    <span
      className={cx(styles.trigger, className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {cloneElement(child, { 'aria-describedby': describedBy })}
      <span
        ref={bubbleRef}
        id={id}
        role="tooltip"
        hidden={!open}
        className={cx(styles.bubble, styles[placement])}
        style={shift ? { '--ms-tooltip-shift': `${shift}px` } : undefined}
      >
        {text}
      </span>
    </span>
  );
}
