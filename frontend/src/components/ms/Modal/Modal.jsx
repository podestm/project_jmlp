import { useId, useRef } from 'react';
import CloseButton from '../CloseButton/CloseButton.jsx';
import { cx } from '../cx.js';
import styles from './Modal.module.css';
import { useDialog } from './useDialog.js';

/**
 * Dialog na nativním <dialog>.showModal() (DialogPotvrzeni). Zůstává ve
 * stromu DOM (žádný portál). Řízený zvenku: `open`
 * a `onClose(reason)`.
 *
 * Chování (useDialog.js):
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
  const closeButtonRef = useRef(null);
  const titleId = useId();
  const dialogProps = useDialog({ open, onClose, dismissible, initialFocusRef, fallbackFocusRef: closeButtonRef });

  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      className={cx(styles.dialog, styles[size], className)}
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
