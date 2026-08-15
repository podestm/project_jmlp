/**
 * Výsledek hromadného přepočtu kategorií závodníků.
 *
 * Seznam `updates` vrací backend jen když závodníkům skutečně přeřadil
 * kategorii; souhrn `summary` je tam vždy.
 */
export default function RecalculateSummary({ result, onDismiss }) {
  return (
    <div className="mb-4">
      <div className="alert alert-success d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center">
          <i className="bi bi-check-circle-fill me-2"></i>
          <div>
            <strong>Přepočet kategorií dokončen</strong>
            <small className="d-block text-muted mt-1">
              Kategorie byly aktualizovány podle ročníků narození a pohlaví závodníků
            </small>
          </div>
        </div>
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={onDismiss}
          title="Skrýt výsledky"
        >
          <i className="bi bi-x"></i>
        </button>
      </div>

      {result.updates && result.updates.length > 0 && (
        <div className="card">
          <div className="card-header bg-light">
            <h6 className="mb-0">
              <i className="bi bi-arrow-repeat me-2"></i>
              Aktualizováno {result.updates.length} závodníků
            </h6>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table className="table table-sm table-hover mb-0">
                <thead className="sticky-top bg-light">
                  <tr>
                    <th>Závodník</th>
                    <th>Ročník</th>
                    <th>Pohlaví</th>
                    <th>Změna kategorie</th>
                  </tr>
                </thead>
                <tbody>
                  {result.updates.map((update, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{update.name}</strong>
                      </td>
                      <td>
                        <span className="badge bg-secondary">{update.birth_year}</span>
                      </td>
                      <td>
                        <span className={`badge ${
                          update.sex === 1 ? 'bg-info' : update.sex === 2 ? 'bg-pink' : 'bg-secondary'
                        }`}>
                          {update.sex === 1 ? 'Muž' : update.sex === 2 ? 'Žena' : 'Mix'}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <span className="text-muted me-2">{update.old_category}</span>
                          <i className="bi bi-arrow-right text-primary me-2"></i>
                          <span className="fw-bold">{update.new_category}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {result.summary && (
        <div className="row mt-3">
          <div className="col-md-4">
            <div className="card bg-transparent border-0 text-center">
              <div className="card-body py-2">
                <small className="text-muted d-block">Celkem zkontrolováno</small>
                <strong>{result.summary.total_racers || 0}</strong>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card text-center" style={{ backgroundColor: 'rgba(13, 110, 253, 0.1)', border: '1px solid rgba(13, 110, 253, 0.3)' }}>
              <div className="card-body py-2">
                <small className="d-block">Aktualizováno</small>
                <strong className="text-primary">{result.summary.updated_racers || 0}</strong>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card text-center" style={{ backgroundColor: 'rgba(25, 135, 84, 0.1)', border: '1px solid rgba(25, 135, 84, 0.3)' }}>
              <div className="card-body py-2">
                <small className="d-block">Bez změny</small>
                <strong className="text-success">{result.summary.unchanged_racers || 0}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
