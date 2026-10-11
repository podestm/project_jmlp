import Icon from '../../ms/Icon/Icon.jsx';
/**
 * Formulář pro založení a úpravu kategorie.
 *
 * Vytaženo z CategoryManagement.jsx - stav i odeslání zůstávají v rodiči,
 * tohle je jen řízené zobrazení, aby obrazovka nebyla jeden tisícřádkový soubor.
 */
export default function CategoryForm({
  formData,
  editingCategory,
  onChange,
  onSubmit,
  onCancel
}) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="card mb-4">
      <div className="card-header">
        <h5 className="mb-0">
          {editingCategory ? 'Upravit kategorii' : 'Nová kategorie'}
        </h5>
      </div>
      <div className="card-body">
        <form onSubmit={onSubmit}>
          <div className="row">
            <div className="col-md-3 mb-3">
              <label htmlFor="name" className="form-label">
                Interní název <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                id="name"
                name="name"
                value={formData.name}
                onChange={onChange}
                required
                placeholder="např. U21 Junioři"
              />
              <div className="form-text">Používá se pro párování ročníků.</div>
            </div>

            {/* Zobrazovaný název je nepovinný - když chybí, všude se použije
                interní název (viz výpis v CategoryTable). */}
            <div className="col-md-3 mb-3">
              <label htmlFor="display_name" className="form-label">
                Zobrazovaný název
              </label>
              <input
                type="text"
                className="form-control"
                id="display_name"
                name="display_name"
                value={formData.display_name}
                onChange={onChange}
                placeholder="např. Myšáci dívky"
              />
              <div className="form-text">Název na webu, v časomíře i ve výsledkové listině.</div>
            </div>

            <div className="col-md-2 mb-3">
              <label htmlFor="sex" className="form-label">
                Pohlaví <span className="text-danger">*</span>
              </label>
              <select
                className="form-select"
                id="sex"
                name="sex"
                value={formData.sex}
                onChange={onChange}
                required
              >
                <option value={0}>Mix (muži i ženy)</option>
                <option value={1}>Muži</option>
                <option value={2}>Ženy</option>
              </select>
            </div>

            <div className="col-md-2 mb-3">
              <label htmlFor="min_birth_year" className="form-label">
                Nejstarší ročník <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                className="form-control"
                id="min_birth_year"
                name="min_birth_year"
                value={formData.min_birth_year}
                onChange={onChange}
                required
                min="1900"
                max={currentYear}
                placeholder="např. 1990"
              />
              <small className="text-muted">
                Věk: {currentYear - formData.min_birth_year} let
              </small>
            </div>

            <div className="col-md-2 mb-3">
              <label htmlFor="max_birth_year" className="form-label">
                Nejmladší ročník <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                className="form-control"
                id="max_birth_year"
                name="max_birth_year"
                value={formData.max_birth_year}
                onChange={onChange}
                required
                min="1900"
                max={currentYear}
                placeholder="např. 2005"
              />
              <small className="text-muted">
                Věk: {currentYear - formData.max_birth_year} let
              </small>
            </div>

            <div className="col-md-3 mb-3">
              <label htmlFor="active" className="form-label">
                Stav
              </label>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="active"
                  name="active"
                  checked={formData.active}
                  onChange={onChange}
                />
                <label className="form-check-label" htmlFor="active">
                  {formData.active ? 'Aktivní' : 'Neaktivní'}
                </label>
              </div>
            </div>
          </div>

          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-primary">
              <Icon name="save" className="me-2" />
              {editingCategory ? 'Uložit změny' : 'Vytvořit kategorii'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Zrušit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
