/**
 * Report kontroly pokrytí ročníků kategoriemi (endpoint /categories/check/coverage).
 *
 * Rozbalení detailů drží rodič ve stavu, ne Bootstrap `data-bs-toggle="collapse"` -
 * bootstrap.js se v aplikaci vůbec nenačítá, takže by tlačítko nedělalo nic.
 *
 * Všechna pole z API se čtou přes `?.` - starší backend vracel plochý tvar
 * (gap_ranges / overlaps) a inactive_categories nemusí dorazit vůbec.
 */
export default function CoverageReport({ report, showDetails, onToggleDetails, onClose }) {
  const bySex = report.results_by_sex;

  return (
    <div className="card mb-4 border-info">
      <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
        <h5 className="mb-0">
          <i className="bi bi-clipboard-check me-2"></i>
          Výsledek kontroly pokrytí kategorií
        </h5>
        <button className="btn btn-sm btn-light" onClick={onClose}>
          <i className="bi bi-x-lg"></i>
        </button>
      </div>
      <div className="card-body">
        <div className="row mb-3">
          <div className="col-md-3">
            <div className="card bg-transparent border-0">
              <div className="card-body text-center">
                <h6 className="text-muted mb-2">Status</h6>
                <span className={`badge ${report.status === 'ok' ? 'bg-success' : 'bg-warning'} fs-6`}>
                  {report.status === 'ok' ? 'OK' : 'Varování'}
                </span>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-transparent border-0">
              <div className="card-body text-center">
                <h6 className="text-muted mb-2">Kontrolovaný rozsah</h6>
                <strong>{report.check_range?.min} - {report.check_range?.max}</strong>
                <br />
                <small className="text-muted">({report.check_range?.total_years} let)</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-transparent border-0">
              <div className="card-body text-center">
                <h6 className="text-muted mb-2">Aktivních kategorií</h6>
                <strong>{report.active_categories}</strong>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-transparent border-0">
              <div className="card-body text-center">
                <h6 className="text-muted mb-2">Nepokryté rozmezí</h6>
                <strong className="text-danger">
                  {bySex
                    ? Object.values(bySex).reduce((sum, sexData) => sum + (sexData.gap_ranges?.length || 0), 0)
                    : (report.gap_ranges?.length || 0)}
                </strong>
                <br />
                <small className="text-muted">rozmezí celkem</small>
              </div>
            </div>
          </div>
        </div>

        {report.racer_range && (
          <div className="alert alert-light border">
            <i className="bi bi-info-circle me-2"></i>
            <strong>Závodníci v databázi:</strong> ročníky {report.racer_range.min} – {report.racer_range.max}
          </div>
        )}

        <div className="alert alert-info mb-3">
          <i className="bi bi-info-circle me-2"></i>
          {report.message}
        </div>

        {/* Zobrazení podle pohlaví - přehlednější layout */}
        {bySex && (
          <div className="row mb-4">
            {Object.entries(bySex).map(([sexName, sexData]) => (
              <div key={sexName} className="col-md-6 mb-3">
                <div className="card h-100 border-primary" style={{ backgroundColor: 'rgba(13, 110, 253, 0.05)' }}>
                  <div className="card-header bg-primary text-white">
                    <h6 className="mb-0">
                      <i className={`bi ${sexName === 'Muži' ? 'bi-person-fill' : 'bi-person-dress-fill'} me-2`}></i>
                      {sexName}
                    </h6>
                  </div>
                  <div className="card-body">
                    <div className="row text-center mb-3">
                      <div className="col-6">
                        <div className="border rounded p-2">
                          <small className="text-muted d-block">Nepokryté rozsahy</small>
                          <strong className={sexData.gap_ranges?.length > 0 ? 'text-danger' : 'text-success'}>
                            {sexData.gap_ranges?.length || 0}
                          </strong>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="border rounded p-2">
                          <small className="text-muted d-block">Překryvy</small>
                          <strong className={sexData.overlap_details?.length > 0 ? 'text-warning' : 'text-success'}>
                            {sexData.overlap_details?.length || 0}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {sexData.gap_ranges && sexData.gap_ranges.length > 0 && (
                      <div className="mb-3">
                        <div className="alert alert-danger alert-sm p-2">
                          <small className="fw-bold text-danger d-block mb-1">
                            <i className="bi bi-exclamation-triangle me-1"></i>
                            Nepokryté rozsahy:
                          </small>
                          {sexData.gap_ranges.map((gap, idx) => (
                            <small key={idx} className="d-block">
                              • {gap.start === gap.end
                                ? `Ročník ${gap.start}`
                                : `Ročníky ${gap.start}–${gap.end} (${gap.count} let)`}
                            </small>
                          ))}
                        </div>
                      </div>
                    )}

                    {sexData.overlap_details && sexData.overlap_details.length > 0 && (
                      <div className="mb-3">
                        <div className="alert alert-warning alert-sm p-2">
                          <small className="fw-bold text-warning d-block mb-1">
                            <i className="bi bi-exclamation-circle me-1"></i>
                            Překryvy:
                          </small>
                          {sexData.overlap_details.slice(0, 3).map((overlap, idx) => (
                            <small key={idx} className="d-block">
                              • Ročník {overlap.year}
                            </small>
                          ))}
                          {sexData.overlap_details.length > 3 && (
                            <small className="text-muted">
                              ... a {sexData.overlap_details.length - 3} dalších
                            </small>
                          )}
                        </div>
                      </div>
                    )}

                    {(!sexData.gap_ranges || sexData.gap_ranges.length === 0) &&
                     (!sexData.overlap_details || sexData.overlap_details.length === 0) && (
                      <div className="alert alert-success alert-sm p-2 text-center">
                        <i className="bi bi-check-circle me-1"></i>
                        <small>Všechny ročníky OK</small>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detailní informace - rozbalovací přes React state */}
        {bySex && (
          <div className="mb-3">
            <button
              className="btn btn-outline-info btn-sm mb-2"
              type="button"
              onClick={onToggleDetails}
              aria-expanded={showDetails}
            >
              <i className={`bi me-1 ${showDetails ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
              {showDetails ? 'Skrýt detaily' : 'Zobrazit detaily'}
            </button>
            {showDetails && (
              <div>
                {Object.entries(bySex).map(([sexName, sexData]) => (
                  <div key={`details-${sexName}`} className="mb-3">
                    <h6 className="text-muted">Detaily pro {sexName}:</h6>

                    {sexData.gap_ranges && sexData.gap_ranges.length > 0 && (
                      <div className="alert alert-danger">
                        <strong>Nepokryté rozsahy ({sexData.gap_ranges.length}):</strong>
                        <ul className="mb-0 mt-1">
                          {sexData.gap_ranges.map((gap, idx) => (
                            <li key={idx}>{gap.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {sexData.overlap_details && sexData.overlap_details.length > 0 && (
                      <div className="alert alert-warning">
                        <strong>Překrývající se ročníky ({sexData.overlap_details.length}):</strong>
                        <ul className="mb-0 mt-1">
                          {sexData.overlap_details.map((overlap, idx) => (
                            <li key={idx}>{overlap.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fallback pro staré API odpovědi bez results_by_sex */}
        {!bySex && (
          <>
            {report.gap_ranges && report.gap_ranges.length > 0 && (
              <div className="mb-3">
                <h6 className="text-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Nepokryté rozsahy ({report.gap_ranges.length})
                </h6>
                <div className="alert alert-danger">
                  <ul className="mb-0">
                    {report.gap_ranges.map((gap, idx) => (
                      <li key={idx}>
                        <strong>{gap.message}</strong>
                        {gap.count > 10 && (
                          <span className="badge bg-danger ms-2">{gap.count} roků</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {report.overlaps && report.overlaps.length > 0 && (
              <div className="mb-3">
                <h6 className="text-warning">
                  <i className="bi bi-exclamation-circle me-2"></i>
                  Překrývající se ročníky ({report.overlaps.length})
                </h6>
                <div className="alert alert-warning">
                  <ul className="mb-0">
                    {report.overlaps.map((overlap, idx) => (
                      <li key={idx}>{overlap.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}

        {report.inactive_categories?.length > 0 && (
          <div className="mb-3">
            <h6 className="text-muted">
              <i className="bi bi-archive me-2"></i>
              Neaktivní kategorie ({report.inactive_categories.length})
            </h6>
            <div className="alert alert-secondary">
              <ul className="mb-0">
                {report.inactive_categories.map((cat, idx) => (
                  <li key={idx}>
                    {/* Stejně jako v tabulce kategorií: hlavní je oficiální
                        název, kódové označení jen jako doplněk. */}
                    <strong>{cat.display_name || cat.name}</strong>
                    {cat.display_name && cat.name && cat.display_name !== cat.name && (
                      <small className="text-muted ms-2">{cat.name}</small>
                    )}
                    {cat.sex && (
                      <span className={`badge ms-2 ${
                        cat.sex === 'Mix' ? 'bg-secondary' :
                        cat.sex === 'Muži' ? 'bg-primary' : 'bg-warning'
                      }`}>
                        {cat.sex}
                      </span>
                    )}
                    <span className="text-muted ms-2">(ročníky {cat.range})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Celkový úspěch - zobrazí se jen pokud není results_by_sex, nebo když jsou všechna pohlaví OK */}
        {!bySex &&
         (!report.gap_ranges || report.gap_ranges.length === 0) &&
         (!report.overlaps || report.overlaps.length === 0) && (
          <div className="alert alert-success">
            <i className="bi bi-check-circle me-2"></i>
            Všechny ročníky od roku 1900 do současnosti jsou správně pokryty kategoriemi bez překryvů.
          </div>
        )}

        {bySex &&
         Object.values(bySex).every(sexData =>
           (!sexData.gap_ranges || sexData.gap_ranges.length === 0) &&
           (!sexData.overlap_details || sexData.overlap_details.length === 0)
         ) && (
          <div className="alert alert-success">
            <i className="bi bi-check-circle me-2"></i>
            Všechny ročníky od roku 1900 do současnosti jsou správně pokryty kategoriemi pro obě pohlaví bez překryvů.
          </div>
        )}
      </div>
    </div>
  );
}
