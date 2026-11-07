import { useEffect, useRef } from 'react';

/**
 * Chování modálního <dialog> bez vzhledu – sdílí ho Modal a celoobrazovková
 * menu (MobileMenu). Vrací props, které se rozprostřou na <dialog>.
 *
 * - open řídí showModal()/close(); onClose(reason) s důvodem 'escape' |
 *   'backdrop' | 'close' (dialog zavřel prohlížeč sám – slib čekající na
 *   odpověď tak nikdy nezůstane viset). Zavírací tlačítko volá onClose samo.
 * - dismissible={false}: Escape ani překryv nezavírají; když dialog přesto
 *   zavře prohlížeč, otevře se znovu.
 * - Počáteční fokus: initialFocusRef → [data-autofocus] (bezpečná volba) →
 *   [data-cancel] (Zrušit, Zavřít menu) → fallbackFocusRef → dialog.
 * - Po zavření i odmontování se fokus vrátí tam, odkud se dialog otevřel.
 *   Stránka pod ním se neroluje (base.css, :root:has(dialog[data-ms-modal][open])).
 */
export function useDialog({ open, onClose, dismissible = true, initialFocusRef, fallbackFocusRef }) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);

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
        ?? fallbackFocusRef?.current
        ?? dialog;
      target.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    if (!open) restoreFocus(returnFocusRef);
    return undefined;
  }, [open, initialFocusRef, fallbackFocusRef]);

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

  return {
    ref: dialogRef,
    'data-ms-modal': '',
    tabIndex: -1,
    onCancel: handleCancel,
    onClose: handleNativeClose,
    onPointerDown: handlePointerDown,
    onClick: handleClick,
  };
}

function restoreFocus(ref) {
  const element = ref.current;
  ref.current = null;
  if (element && element.isConnected && typeof element.focus === 'function') element.focus();
}

export default useDialog;
