/**
 * Placeholder for a list/table with nothing to show.
 *
 * @param {string} icon - Bootstrap icon class, e.g. 'bi-folder2-open'
 * @param {string} title
 * @param {string} [hint] - optional secondary line
 * @param {React.ReactNode} [action] - optional call-to-action button
 */
export default function EmptyState({ icon = 'bi-inbox', title, hint, action }) {
  return (
    <div className="text-center text-muted py-5">
      <i className={`bi ${icon} d-block fs-1 mb-2 opacity-50`} aria-hidden="true" />
      <div className="fw-semibold">{title}</div>
      {hint && <div className="small mt-1">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
