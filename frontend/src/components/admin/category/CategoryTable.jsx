import EmptyState from '../../ui/EmptyState.jsx';
import { formatDateShort } from '../../../utils/date.js';

/** Věkové rozmezí, které kategorie letos pokrývá - počítá se z ročníků. */
const getAgeRange = (category) => {
  const currentYear = new Date().getFullYear();
  const minAge = currentYear - category.max_birth_year;
  const maxAge = currentYear - category.min_birth_year;
  return `${minAge} - ${maxAge} let`;
};

/**
 * Výpis kategorií.
 *
 * `categories` už musí přijít seřazené - řadit uvnitř renderu nad polem ze
 * stavu by ten stav zmutovalo.
 */
export default function CategoryTable({
  categories,
  onEdit,
  onCreateMirror,
  onToggleActive,
  onDelete
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">Seznam kategorií</h5>
      </div>
      <div className="card-body">
        {categories.length === 0 ? (
          <EmptyState icon="bi-inbox" title="Zatím nebyly vytvořeny žádné kategorie" />
        ) : (
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead className="table-dark">
                <tr>
                  <th>Název</th>
                  <th>Pohlaví</th>
                  <th>Ročníky</th>
                  <th>Věkový rozsah</th>
                  <th>Stav</th>
                  <th>Vytvořeno</th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(category => (
                  <tr key={category.id}>
                    <td>
                      {/* Hlavní je zobrazovaný název; interní se ukáže pod ním,
                          jen když se od něj liší (tj. když vůbec je vyplněný). */}
                      <strong>{category.display_name || category.name}</strong>
                      {category.display_name && (
                        <div>
                          <small className="text-muted">{category.name}</small>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                        category.sex === 0 ? 'bg-secondary' :
                        category.sex === 1 ? 'bg-primary' : 'bg-warning'
                      }`}>
                        {category.sex === 0 ? 'Mix' :
                         category.sex === 1 ? 'Muži' : 'Ženy'}
                      </span>
                    </td>
                    <td>
                      <code className="bg-light px-2 py-1 rounded">
                        {category.min_birth_year} - {category.max_birth_year}
                      </code>
                    </td>
                    <td>
                      <span className="badge bg-info text-dark">
                        {getAgeRange(category)}
                      </span>
                    </td>
                    <td>
                      {category.active ? (
                        <span className="badge bg-success">Aktivní</span>
                      ) : (
                        <span className="badge bg-secondary">Neaktivní</span>
                      )}
                    </td>
                    <td>{formatDateShort(category.created_at)}</td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-primary"
                          onClick={() => onEdit(category)}
                          title="Upravit kategorii"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-outline-info"
                          onClick={() => onCreateMirror(category)}
                          title={`Vytvořit zrcadlovou kategorii pro ${category.sex === 1 ? 'ženy' : category.sex === 2 ? 'muže' : 'opačné pohlaví'}`}
                          disabled={category.sex === 0}
                        >
                          <i className="bi bi-arrows-angle-expand"></i>
                        </button>
                        <button
                          className={`btn btn-outline-${category.active ? 'warning' : 'success'}`}
                          onClick={() => onToggleActive(category.id, category.active)}
                          title={category.active ? 'Deaktivovat kategorii' : 'Aktivovat kategorii'}
                        >
                          <i className={`bi ${category.active ? 'bi-pause-circle' : 'bi-play-circle'}`}></i>
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => onDelete(category)}
                          title="Smazat kategorii"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
