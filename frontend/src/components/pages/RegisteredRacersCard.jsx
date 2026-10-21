import { useEffect, useMemo, useState } from 'react';
import LoadingState from '../ui/LoadingState.jsx';

/**
 * "Seznam registrovaných závodníků" card, shared by RaceDetail and Registration.
 *
 * @param {Object|null} registrations - payload of /races/{id}/registrations
 * @param {boolean} loading
 * @param {string} [className] - Registration renders it with `mt-4`, RaceDetail
 *   flush against the form; hardcoding either would change one page's spacing.
 */
export default function RegisteredRacersCard({ registrations, loading, className = '' }) {
  const [clubFilter, setClubFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Řádky tabulky (závodník + jeho klub) a volby filtrů. Kategorie chodí ze
  // serveru v pořadí závodu, kluby abecedně.
  const rows = useMemo(() => (registrations?.clubs || []).flatMap((club) => (
    club.racers.map((racer, index) => ({ racer, clubName: club.club_name, key: `${club.club_name}-${index}` }))
  )), [registrations]);
  const clubOptions = useMemo(() => (
    (registrations?.clubs || []).map((club) => club.club_name).sort((a, b) => a.localeCompare(b, 'cs'))
  ), [registrations]);
  const categoryOptions = registrations?.categories || [];
  const hasUncategorized = rows.some(({ racer }) => racer.category_id == null);

  const visibleRows = rows.filter(({ racer, clubName }) => (
    (!clubFilter || clubName === clubFilter)
    && (!categoryFilter
      || (categoryFilter === 'none' ? racer.category_id == null : String(racer.category_id) === categoryFilter))
  ));
  const filtersActive = Boolean(clubFilter || categoryFilter);

  return (
    <div className={`card ${className}`.trim()} style={{
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.1)',
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
    }}>
      <div className="card-header" style={{
        background: 'linear-gradient(135deg, var(--sunset-orange) 0%, #e65a00 100%)',
        color: 'white',
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px',
        padding: '1rem 1.25rem'
      }}>
        <h5 className="card-title mb-0">
          <i className="bi bi-people me-2"></i>
          Seznam registrovaných závodníků ({registrations?.total_racers || 0})
        </h5>
      </div>
      <div className="card-body">
        {loading ? (
          <LoadingState variant="inline" />
        ) : !registrations || registrations.total_racers === 0 ? (
          <div className="text-center text-muted py-3">
            <i className="bi bi-person-x" style={{ fontSize: '3rem' }}></i>
            <p className="mt-2">Zatím není nikdo přihlášen</p>
          </div>
        ) : (
          <>
          <div className="row g-3 align-items-end mb-3">
            <div className="col-md-5">
              <label className="form-label" htmlFor="registered-club-filter">
                <i className="bi bi-buildings me-1"></i>
                Klub
              </label>
              <select
                id="registered-club-filter"
                className="form-select"
                value={clubFilter}
                onChange={(e) => setClubFilter(e.target.value)}
              >
                <option value="">Všechny kluby</option>
                {clubOptions.map((club) => <option key={club} value={club}>{club}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="registered-category-filter">
                <i className="bi bi-tag me-1"></i>
                Kategorie
              </label>
              <select
                id="registered-category-filter"
                className="form-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">Všechny kategorie</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={String(category.id)}>{category.name}</option>
                ))}
                {hasUncategorized && <option value="none">Bez kategorie</option>}
              </select>
            </div>
            <div className="col-md-3 d-flex align-items-center gap-2">
              {filtersActive && (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => { setClubFilter(''); setCategoryFilter(''); }}
                >
                  <i className="bi bi-x-circle me-1"></i>
                  Zrušit
                </button>
              )}
              <small className="text-muted">Zobrazeno {visibleRows.length} z {rows.length}</small>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-hover">
              <thead className="table-light">
                <tr>
                  <th>Jméno</th>
                  <th>Příjmení</th>
                  <th>Pohlaví</th>
                  <th>Ročník</th>
                  <th>Kategorie</th>
                  <th>SLČR ID</th>
                  <th>Klub</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ racer, clubName, key }) => (
                    <tr key={key}>
                      <td>{racer.firstName}</td>
                      <td>{racer.lastName}</td>
                      <td>
                        {racer.sex && (
                          <span className={`badge ${racer.sex === 'M' ? 'bg-primary' : 'bg-warning'}`}>
                            {racer.sex === 'M' ? 'Muž' : 'Žena'}
                          </span>
                        )}
                      </td>
                      <td>{racer.birthYear || '-'}</td>
                      <td>
                        {racer.category_name
                          ? <span className="badge bg-info">{racer.category_name}</span>
                          : '-'}
                      </td>
                      <td className="text-danger">{racer.idSlcr || '-'}</td>
                      <td><span className="badge bg-secondary">{clubName}</span></td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Fetch the registration list for a race, re-fetching whenever `refreshToken`
 * changes (both pages bump it after a successful registration and when the
 * user comes back to the tab).
 *
 * @returns {{registrations: Object|null, loading: boolean}}
 */
export const useRaceRegistrations = (raceId, refreshToken = 0) => {
  const [registrations, setRegistrations] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!raceId) {
      setRegistrations(null);
      return undefined;
    }

    let cancelled = false;
    const fetchRegistrations = async () => {
      setLoading(true);
      try {
        const data = await fetch(`/races/${raceId}/registrations`).then(r => r.json());
        if (!cancelled) setRegistrations(data);
      } catch (err) {
        console.error('Chyba pri nacitani registraci:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRegistrations();

    return () => { cancelled = true; };
  }, [raceId, refreshToken]);

  return { registrations, loading };
};
