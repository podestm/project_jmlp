const TIMEKEEPER_COLOR = '#e94560';

/**
 * The single loading indicator for the whole app.
 *
 * @param {'page'|'fullscreen'|'inline'|'timekeeper'} [variant]
 *   page       - default block spinner for a screen that is still loading
 *   fullscreen - centred in the viewport (auth gates, before the layout exists)
 *   inline     - small spinner inside a card body
 *   timekeeper - small spinner in the timekeeper accent colour
 * @param {string} [label] - screen-reader text
 */
export default function LoadingState({ variant = 'page', label = 'Načítám...' }) {
  if (variant === 'fullscreen') {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">{label}</span>
        </div>
      </div>
    );
  }

  if (variant === 'timekeeper') {
    return (
      <div className="text-center py-4">
        <div className="spinner-border spinner-border-sm" style={{ color: TIMEKEEPER_COLOR }} role="status">
          <span className="visually-hidden">{label}</span>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="text-center py-3">
        <div className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-5">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">{label}</span>
      </div>
    </div>
  );
}

/** Spinner for inside a submit button while the request is in flight. */
export function ButtonSpinner() {
  return <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />;
}
