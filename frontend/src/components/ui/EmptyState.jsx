import Icon from '../ms/Icon/Icon.jsx';
/**
 * Placeholder for a list/table with nothing to show.
 *
 * @param {string} icon - název ikony z components/ms/Icon/icons.js, např. 'folder'
 * @param {string} title
 * @param {string} [hint] - optional secondary line
 * @param {React.ReactNode} [action] - optional call-to-action button
 */
export default function EmptyState({ icon = 'inbox', title, hint, action }) {
  return (
    <div className="text-center text-muted py-5">
      <Icon name={icon} className="d-block mx-auto fs-1 mb-2 opacity-50" />
      <div className="fw-semibold">{title}</div>
      {hint && <div className="small mt-1">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
