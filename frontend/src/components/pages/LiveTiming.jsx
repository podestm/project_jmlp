import { useState, useEffect, useRef } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { getRaceNumberBadgeStyle } from '../../utils/raceNumbers.js';

const formatTime = (t) => t != null ? t.toFixed(2) : '—';

const renderPositionBadge = (pos) => {
  if (!pos) return <span className="text-muted">—</span>;
  if (pos === 1) return <span className="badge" style={{ background: '#FFD700', color: '#000', fontSize: '0.75rem' }}>1.</span>;
  if (pos === 2) return <span className="badge" style={{ background: '#C0C0C0', color: '#000', fontSize: '0.75rem' }}>2.</span>;
  if (pos === 3) return <span className="badge" style={{ background: '#CD7F32', color: '#000', fontSize: '0.75rem' }}>3.</span>;
  return <span className="fw-bold">{pos}.</span>;
};

const rankEntries = (entries) => {
  const sorted = [...entries].sort((a, b) => {
    const aHasTime = a.status == null && a.time_sum != null;
    const bHasTime = b.status == null && b.time_sum != null;
    if (aHasTime && !bHasTime) return -1;
    if (!aHasTime && bHasTime) return 1;
    if (aHasTime && bHasTime && a.time_sum !== b.time_sum) return a.time_sum - b.time_sum;
    const order = { DSQ: 1, DNF: 2, DNS: 3 };
    return (order[a.status] ?? 99) - (order[b.status] ?? 99);
  });
  let lastTime = null, lastRank = 0;
  return sorted.map((e, i) => {
    const hasTime = e.status == null && e.time_sum != null;
    let rank = null;
    if (hasTime) {
      rank = e.time_sum === lastTime ? lastRank : i + 1;
      lastTime = e.time_sum;
      lastRank = rank;
    }
    return { ...e, display_rank: rank };
  });
};

const EntryTable = ({ entries }) => {
  const ranked = rankEntries(entries);
  return (
    <div className="table-responsive">
      <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: '0.82rem' }}>
        <thead className="table-light">
          <tr>
            <th style={{ width: '70px', padding: '4px 8px' }}>Pořadí</th>
            <th style={{ width: '72px', padding: '4px 8px' }}>Dres</th>
            <th style={{ padding: '4px 8px' }}>Závodník</th>
            <th style={{ padding: '4px 8px' }}>Klub</th>
            <th style={{ width: '75px', padding: '4px 8px' }} className="text-end">Jízda 1</th>
            <th style={{ width: '75px', padding: '4px 8px' }} className="text-end">Jízda 2</th>
            <th style={{ width: '85px', padding: '4px 8px' }} className="text-end fw-bold">Celk. čas</th>
            <th style={{ width: '50px', padding: '4px 8px' }}>Stav</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((e) => (
            <tr key={e.id} className={e.status ? 'table-light text-muted' : ''}>
              <td className="text-center" style={{ padding: '3px 8px' }}>{renderPositionBadge(e.display_rank)}</td>
              <td style={{ padding: '3px 8px' }}>
                <span className="badge" style={{ ...getRaceNumberBadgeStyle(e.set_color), fontSize: '0.8rem' }}>
                  {e.race_number_actual ?? '—'}
                </span>
              </td>
              <td style={{ padding: '3px 8px' }}>
                <span className="fw-semibold">{e.racer_surname} {e.racer_name}</span>
                <small className="text-muted ms-1">({e.racer_year})</small>
              </td>
              <td className="text-muted" style={{ padding: '3px 8px' }}>{e.club_name || '—'}</td>
              <td className="text-end" style={{ padding: '3px 8px', fontFamily: 'monospace' }}>{e.status ? '—' : formatTime(e.time1)}</td>
              <td className="text-end" style={{ padding: '3px 8px', fontFamily: 'monospace' }}>{e.status ? '—' : formatTime(e.time2)}</td>
              <td className="text-end fw-bold" style={{ padding: '3px 8px', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                {e.status ? <span className="text-muted">{e.status}</span> : formatTime(e.time_sum)}
              </td>
              <td className="text-center" style={{ padding: '3px 8px' }}>
                {e.status === 'DNF' && <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>DNF</span>}
                {e.status === 'DNS' && <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>DNS</span>}
                {e.status === 'DSQ' && <span className="badge bg-danger" style={{ fontSize: '0.65rem' }}>DSQ</span>}
                {!e.status && e.time_sum != null && <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '0.8rem' }}></i>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function LiveTiming() {
  const [data, setData] = useState(null);
  const [notLive, setNotLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [lastRaceName, setLastRaceName] = useState(null);
  const intervalRef = useRef(null);

  const fetchResults = async () => {
    try {
      const res = await fetch('/races/live', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRaceName(json.areal_name || null);
        setNotLive(false);
        setLastUpdate(new Date());
      } else {
        setData(null);
        setNotLive(true);
      }
    } catch { /* keep last data */ }
  };

  useEffect(() => {
    fetchResults();
    intervalRef.current = setInterval(fetchResults, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Auto-select first category
  useEffect(() => {
    const cats = data?.categories || [];
    if (!cats.length) { setSelectedCategoryId(''); return; }
    const exists = cats.some(c => String(c.category_id) === String(selectedCategoryId));
    if (!exists) setSelectedCategoryId(String(cats[0].category_id));
  }, [data]);

  if (notLive) {
    // Never had live data in this session → just redirect (direct URL access with no race)
    if (!lastRaceName) return <Navigate to="/" replace />;
    // Had live data but race ended → show debrief
    return (
      <div className="text-center py-5">
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🏁</div>
        <h4 className="fw-bold mb-1">Živé vysílání skončilo</h4>
        <p className="text-muted mb-4">{lastRaceName}</p>
        <p className="text-muted small mb-4">Výsledky budou po ověření k dispozici v sekci Výsledky.</p>
        <div className="d-flex gap-2 justify-content-center">
          <Link to="/zavody" className="btn btn-outline-secondary">
            <i className="bi bi-trophy me-1"></i>Výsledky
          </Link>
          <Link to="/" className="btn btn-outline-secondary">
            <i className="bi bi-house me-1"></i>Úvod
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border spinner-border-sm" style={{ color: '#e94560' }}></div>
      </div>
    );
  }

  const categories = [...(data.categories || [])].reverse();
  const selectedCat = categories.find(c => String(c.category_id) === String(selectedCategoryId)) || null;

  return (
    <div>
      {/* Unofficial warning */}
      <div className="alert alert-warning py-2 d-flex align-items-center gap-2 mb-3" style={{ borderRadius: '8px', fontSize: '0.85rem' }}>
        <i className="bi bi-exclamation-triangle-fill"></i>
        <span><strong>Neoficiální výsledky</strong> — průběžné výsledky živého přenosu, nejsou závazné ani ověřené rozhodčím.</span>
      </div>

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="fw-bold mb-0">
            <span style={{
              display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%',
              background: '#e94560', marginRight: '8px',
              boxShadow: '0 0 8px #e94560',
              animation: 'livePulse 1.2s ease-in-out infinite'
            }} />
            {data.areal_name}
            {data.race_method_id && <span className="ms-2">{data.race_method_id === 1 ? '❄️' : '🌲'}</span>}
          </h5>
          <small className="text-muted">
            {data.race_nr && <span className="me-2">{data.race_nr}</span>}
            {data.race_date && new Date(data.race_date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
          </small>
        </div>
        <div className="text-end">
          <small className="text-muted d-block">Aktualizováno {lastUpdate?.toLocaleTimeString('cs-CZ')}</small>
          <button className="btn btn-sm btn-outline-secondary mt-1" style={{ borderRadius: '6px', fontSize: '0.75rem' }} onClick={fetchResults}>
            <i className="bi bi-arrow-clockwise me-1"></i>Obnovit
          </button>
        </div>
      </div>

      {/* Category pills */}
      {categories.length > 0 && (
        <div className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
          <div className="card-body py-2 px-3">
            <div className="d-flex align-items-center gap-1 flex-wrap">
              <small className="fw-semibold me-1" style={{ color: '#e94560' }}>
                <i className="bi bi-tag me-1"></i>Kat:
              </small>
              {categories.map((cat) => {
                const isActive = String(selectedCategoryId) === String(cat.category_id);
                return (
                  <button
                    key={cat.category_id}
                    className={`btn py-0 px-2 ${isActive ? '' : 'btn-outline-light'}`}
                    style={{
                      fontSize: '0.75rem', borderRadius: '12px',
                      ...(isActive ? { background: '#e94560', color: 'white', border: 'none' } : {})
                    }}
                    onClick={() => setSelectedCategoryId(String(cat.category_id))}
                  >
                    {cat.category_name} ({cat.entries.length})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Results table */}
      {selectedCat && (
        <div className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
          <div className="card-header bg-white py-2 px-3" style={{ borderRadius: '10px 10px 0 0', borderBottom: '2px solid #e94560' }}>
            <small className="fw-bold">
              <i className="bi bi-tag-fill me-1" style={{ color: '#e94560' }}></i>
              {selectedCat.category_name}
              <span className="badge bg-secondary ms-1" style={{ fontSize: '0.65rem' }}>{selectedCat.entries.length}</span>
            </small>
          </div>
          <div className="card-body p-0">
            <EntryTable entries={selectedCat.entries} />
          </div>
        </div>
      )}

      {categories.length === 0 && (
        <div className="text-center py-4">
          <i className="bi bi-clock text-muted" style={{ fontSize: '2rem' }}></i>
          <p className="text-muted mt-2 mb-0 small">Čeká se na první časy...</p>
        </div>
      )}

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
