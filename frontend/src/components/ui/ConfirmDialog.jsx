import { useEffect, useRef } from 'react';

/**
 * Confirmation modal rendered with Bootstrap CSS only - the project does not
 * load Bootstrap's JS bundle, so show/hide is handled here.
 *
 * @param {string} title
 * @param {React.ReactNode} message
 * @param {Array<{value: *, label: string, variant?: string, icon?: string, hint?: string,
 *   disabled?: boolean}>} choices
 *   The buttons offered besides Cancel. A single choice is the usual
 *   confirm/cancel pair; several choices replace a free-text prompt. A choice
 *   is disabled while the dialog body still needs an answer - deleting a club
 *   waits this way until a club to move its racers to is picked.
 * @param {string} [cancelLabel]
 * @param {function} onResolve - called with the chosen value, or null on cancel
 */
export default function ConfirmDialog({
  title,
  message,
  choices,
  cancelLabel = 'Zrušit',
  onResolve
}) {
  const primaryRef = useRef(null);

  useEffect(() => {
    primaryRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onResolve(null);
    };
    document.addEventListener('keydown', onKeyDown);

    // Stop the page behind the modal from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onResolve]);

  return (
    <>
      <div className="modal-backdrop fade show" onClick={() => onResolve(null)} />
      <div
        className="modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onResolve(null); }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="confirm-dialog-title">{title}</h5>
              {/* Vlastní popisek, ne cancelLabel - dvě tlačítka se stejným
                  názvem se ve čtečce obrazovky nedají rozlišit. */}
              <button
                type="button"
                className="btn-close"
                aria-label="Zavřít"
                onClick={() => onResolve(null)}
              />
            </div>
            <div className="modal-body">{message}</div>
            <div className="modal-footer flex-wrap gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={() => onResolve(null)}>
                {cancelLabel}
              </button>
              {choices.map((choice, index) => (
                <button
                  key={String(choice.value)}
                  type="button"
                  ref={index === 0 ? primaryRef : undefined}
                  className={`btn btn-${choice.variant || 'primary'}`}
                  disabled={choice.disabled}
                  onClick={() => onResolve(choice.value)}
                  title={choice.hint}
                >
                  {choice.icon && <i className={`bi ${choice.icon} me-1`} aria-hidden="true" />}
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
