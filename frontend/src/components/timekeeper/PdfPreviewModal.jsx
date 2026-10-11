import { useEffect } from 'react';
import { ButtonSpinner } from '../ui/LoadingState.jsx';
import Icon from '../ms/Icon/Icon.jsx';

/**
 * Náhled vygenerované listiny (startovní i výsledkové) a druhé potvrzení
 * před publikací.
 *
 * Modál, ne window.open: blob vzniká asynchronně až po kliknutí, takže
 * nové okno by prohlížeč spolehlivě zablokoval jako popup.
 */
export default function PdfPreviewModal({
  objectUrl,
  title,
  canPublish = false,
  publishLabel = 'Publikovat k závodu',
  publishing = false,
  onPublish,
  onClose
}) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape' && !publishing) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, publishing]);

  return (
    <>
      <div className="modal-backdrop fade show" onClick={() => !publishing && onClose()} />
      <div className="modal fade show d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content" style={{ height: '90vh' }}>
            <div className="modal-header py-2">
              <h6 className="modal-title">{title}</h6>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                disabled={publishing}
                aria-label="Zavřít"
              />
            </div>
            <div className="modal-body p-0">
              <iframe
                src={objectUrl}
                title={title}
                style={{ width: '100%', height: '100%', border: 0 }}
              />
            </div>
            {/* Stažení i tisk má vestavěný prohlížeč PDF, zavírá křížek nahoře -
                dole zůstává jen to, co prohlížeč neumí: publikace. */}
            {canPublish && (
              <div className="modal-footer py-2">
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={onPublish}
                  disabled={publishing}
                >
                  {publishing ? <ButtonSpinner /> : <Icon name="upload" className="me-1" />}
                  {publishLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
