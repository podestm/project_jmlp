import React, { useState, useEffect } from 'react';
import { useAuth } from '../../config/auth.jsx';
import { API } from '../../config/api.js';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState({
    totalRaces: 0,
    openRaces: 0,
    upcomingRaces: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get races data
      const races = await API.get('/admin/races', {}, {
        'Authorization': `Bearer ${token}`
      });

      // Calculate stats
      const totalRaces = races.length;
      const openRaces = races.filter(race => race.registration && !race.closed).length;
      const today = new Date();
      const upcomingRaces = races.filter(race => {
        if (!race.datum) return false;
        const raceDate = new Date(race.datum);
        return raceDate > today;
      }).length;

      setStats({
        totalRaces,
        openRaces,
        upcomingRaces,
        recentActivity: races.slice(0, 5) // Last 5 races
      });

    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Načítám...</span>
        </div>
        <p className="mt-2 text-muted">Načítám dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        Chyba při načítání dashboard: {error}
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Bez data';
    return new Date(dateString).toLocaleDateString('cs-CZ');
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Dashboard</h1>
        <button onClick={loadDashboardData} className="btn btn-outline-primary">
          <i className="bi bi-arrow-clockwise me-2"></i>
          Obnovit
        </button>
      </div>

      {/* Stats Cards */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card bg-primary text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h4>{stats.totalRaces}</h4>
                  <p className="mb-0">Celkem závodů</p>
                </div>
                <i className="bi bi-trophy fs-1 opacity-50"></i>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card bg-success text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h4>{stats.openRaces}</h4>
                  <p className="mb-0">Otevřené registrace</p>
                </div>
                <i className="bi bi-door-open fs-1 opacity-50"></i>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card bg-info text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h4>{stats.upcomingRaces}</h4>
                  <p className="mb-0">Nadcházející závody</p>
                </div>
                <i className="bi bi-calendar-event fs-1 opacity-50"></i>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card bg-warning text-dark">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h4>Admin</h4>
                  <p className="mb-0">Aktivní session</p>
                </div>
                <i className="bi bi-person-check fs-1 opacity-50"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="row">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-clock-history me-2"></i>
                Poslední závody
              </h5>
            </div>
            <div className="card-body">
              {stats.recentActivity.length === 0 ? (
                <p className="text-muted text-center">Žádné závody nenalezeny</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Číslo závodu</th>
                        <th>Datum</th>
                        <th>Areál</th>
                        <th>Registrace</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentActivity.map((race) => (
                        <tr key={race.id}>
                          <td>
                            <strong>{race.raceNr || `#${race.id}`}</strong>
                          </td>
                          <td>{formatDate(race.datum)}</td>
                          <td>{race.areal_name || 'Neznámý areál'}</td>
                          <td>
                            <span className={`badge ${race.registration ? 'bg-success' : 'bg-secondary'}`}>
                              {race.registration ? 'Otevřená' : 'Uzavřená'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${race.closed ? 'bg-dark' : 'bg-primary'}`}>
                              {race.closed ? 'Uzavřen' : 'Aktivní'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-tools me-2"></i>
                Rychlé akce
              </h5>
            </div>
            <div className="card-body">
              <div className="d-grid gap-2">
                <a href="/admin/races" className="btn btn-primary">
                  <i className="bi bi-plus-circle me-2"></i>
                  Nový závod
                </a>
                <a href="/admin/races" className="btn btn-outline-primary">
                  <i className="bi bi-list me-2"></i>
                  Spravovat závody
                </a>
                <a href="/admin/documents" className="btn btn-outline-success">
                  <i className="bi bi-upload me-2"></i>
                  Nahrát dokumenty
                </a>
                <hr />
                <a href="/" target="_blank" className="btn btn-outline-info">
                  <i className="bi bi-box-arrow-up-right me-2"></i>
                  Zobrazit web
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}