import { useState, useEffect, useRef } from 'react';
import { Navigate, Link } from 'react-router-dom';
import ResultsTable, { CategoryPills } from '../timekeeper/ResultsTable.jsx';
import Icon from '../ms/Icon/Icon.jsx';

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
            <Icon name="trophy" className="me-1" />Výsledky
          </Link>
          <Link to="/" className="btn btn-outline-secondary">
            <Icon name="home" className="me-1" />Úvod
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
        <Icon name="warning" />
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
            <Icon name="refresh" className="me-1" />Obnovit
          </button>
        </div>
      </div>

      {/* Výběr kategorie - na tmavém veřejném pozadí musí být neaktivní pilulky světlé */}
      {categories.length > 0 && (
        <CategoryPills
          categories={categories}
          selectedId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
          inactiveClass="btn-outline-light"
        />
      )}

      {/* Results table */}
      {selectedCat && (
        <div className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
          <div className="card-header bg-white py-2 px-3" style={{ borderRadius: '10px 10px 0 0', borderBottom: '2px solid #e94560' }}>
            <small className="fw-bold">
              <Icon name="tag" className="me-1" style={{ color: '#e94560' }} />
              {selectedCat.category_name}
              <span className="badge bg-secondary ms-1" style={{ fontSize: '0.65rem' }}>{selectedCat.entries.length}</span>
            </small>
          </div>
          {/* showPoints zůstává vypnuté - body se počítají až z oficiálních výsledků */}
          <div className="card-body p-0">
            <ResultsTable entries={selectedCat.entries} />
          </div>
        </div>
      )}

      {categories.length === 0 && (
        <div className="text-center py-4">
          <Icon name="clock" className="text-muted" style={{ fontSize: '2rem' }} />
          <p className="text-muted mt-2 mb-0 small">Čeká se na první časy...</p>
        </div>
      )}

      <style>{`@layer legacy {
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      }`}</style>
    </div>
  );
}
