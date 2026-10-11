import { useEffect, useId, useRef } from 'react';
import CloseButton from '../CloseButton/CloseButton.jsx';
import { cx } from '../cx.js';
import styles from './Modal.module.css';

/**
 * Dialog na nativním <dialog>.showModal() (DialogPotvrzeni). Zůstává ve
 * stromu DOM (žádný portál), kořen má .ms-scope. Řízený zvenku: `open`
 * a `onClose(reason)`.
 *
 * Chování:
 * - Escape, křížek i klik do překryvu znamenají zavřít (onClose s důvodem
 *   'escape' | 'button' | 'backdrop'). onClose se zavolá i tehdy, když dialog
 *   zavře prohlížeč sám (close-watcher), s důvodem 'close' – slib čekající
 *   na odpověď tak nikdy nezůstane viset.
 * - dismissible={false}: bez křížku, Escape ani překryv nezavírají; když ho
 *   prohlížeč přesto zavře, otevře se znovu.
 * - Počáteční fokus: initialFocusRef → [data-autofocus] (bezpečná volba) →
 *   [data-cancel] (Zrušit) → křížek → dialog. Nikdy první nebezpečná volba.
 * - Po zavření se fokus vrátí tam, odkud se dialog otevřel. Stránka pod ním
 *   se neroluje (base.css, :root:has(dialog[data-ms-modal][open])).
 *
 * Patička: `footer` vpravo (Zrušit, hlavní akce úplně vpravo), `footerStart`
 * vlevo (další nebezpečná volba). Uvnitř Modal nic neportálovat do body.
 *
 * size: sm 480 | md 620 | lg 880 | full (šířka kontejneru 1240 px, výška
 * okna – náhled PDF). flush: tělo bez odsazení, oddělené linkou, na
 * podkladu --ms-surface-sunken (TkDialogNahled*: vestavěný prohlížeč PDF).
 */
export default function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  footerStart,
  size = 'md',
  flush = false,
  dismissible = true,
  closeLabel = 'Zavřít dialog',
  initialFocusRef,
  className,
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const returnFocusRef = useRef(null);
  const titleId = useId();

  // Aktuální props pro posluchače nativních událostí.
  const stateRef = useRef({ open, dismissible, onClose });
  stateRef.current = { open, dismissible, onClose };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement;
      dialog.showModal();
      const target = initialFocusRef?.current
        ?? dialog.querySelector('[data-autofocus]')
        ?? dialog.querySelector('[data-cancel]')
        ?? closeButtonRef.current
        ?? dialog;
      target.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    if (!open) restoreFocus(returnFocusRef);
    return undefined;
  }, [open, initialFocusRef]);

  // Při odmontování otevřeného dialogu vrátit fokus.
  useEffect(() => () => restoreFocus(returnFocusRef), []);

  const handleCancel = (event) => {
    event.preventDefault();
    const { dismissible: canDismiss, onClose: close } = stateRef.current;
    if (canDismiss) close('escape');
  };

  const handleNativeClose = () => {
    const { open: stillOpen, dismissible: canDismiss, onClose: close } = stateRef.current;
    if (!stillOpen) return;
    if (canDismiss) close('close');
    else dialogRef.current?.showModal();
  };

  // Klik do překryvu: událost míří přímo na <dialog>, obsah ho celý vyplňuje.
  const pressedOnBackdrop = useRef(false);
  const handlePointerDown = (event) => {
    pressedOnBackdrop.current = event.target === dialogRef.current;
  };
  const handleClick = (event) => {
    if (event.target !== dialogRef.current || !pressedOnBackdrop.current) return;
    if (stateRef.current.dismissible) stateRef.current.onClose('backdrop');
  };

  return (
    <dialog
      ref={dialogRef}
      data-ms-modal=""
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cx('ms-scope', styles.dialog, styles[size], className)}
      onCancel={handleCancel}
      onClose={handleNativeClose}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {open && (
        <div className={styles.surface}>
          <header className={styles.header}>
            <div className={styles.heading}>
              {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
              <h2 id={titleId} className={styles.title}>{title}</h2>
            </div>
            {dismissible && <CloseButton ref={closeButtonRef} label={closeLabel} onClick={() => onClose('button')} />}
          </header>
          <div className={cx(styles.body, flush && styles.flush)}>{children}</div>
          {(footer || footerStart) && (
            <footer className={styles.footer}>
              {footerStart && <div className={styles.footerStart}>{footerStart}</div>}
              <div className={styles.footerEnd}>{footer}</div>
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}

function restoreFocus(ref) {
  const element = ref.current;
  ref.current = null;
  if (element && element.isConnected && typeof element.focus === 'function') element.focus();
}
