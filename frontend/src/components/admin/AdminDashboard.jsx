import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../config/auth.jsx';
import { AdminAPI } from '../../config/api.js';
import Alert from '../ui/Alert.jsx';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState({
    totalRaces: 0,
    openRaces: 0,
    storageSize: 'Načítám...',
    fileCount: 0,
    visitsLast7Days: 0,
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
      const races = await AdminAPI.get('/admin/races');

      // Calculate stats
      const totalRaces = races.length;
      const openRaces = races.filter(race => race.registration && !race.closed).length;

      // Get storage stats
      let storageSize = 'N/A';
      let fileCount = 0;
      try {
        const storageStats = await AdminAPI.get('/admin/files/storage-stats');
        storageSize = storageStats.total_size_formatted;
        fileCount = storageStats.file_count;
      } catch (storageErr) {
        console.error('Error loading storage stats:', storageErr);
        storageSize = 'Chyba';
      }

      // Get visitor stats
      let visitsLast7Days = 0;
      try {
        const visitorStats = await AdminAPI.get('/admin/analytics/visitors?days=7');
        visitsLast7Days = visitorStats.total_visits;
      } catch (visitorErr) {
        console.error('Error loading visitor stats:', visitorErr);
      }

      setStats({
        totalRaces,
        openRaces,
        storageSize,
        fileCount,
        visitsLast7Days,
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
      <Alert 
        type="danger" 
        message={
          <>
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            Chyba při načítání dashboard: {error}
          </>
        }
        onDismiss={() => setError(null)}
      />
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Bez data';
    return new Date(dateString).toLocaleDateString('cs-CZ');
  };

  return (
    <div>
      <div className="mb-4">
        <h1>Dashboard</h1>
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
                  <h4>{stats.storageSize}</h4>
                  <p className="mb-0">Velikost souborů</p>
                  {stats.fileCount > 0}
                </div>
                <i className="bi bi-hdd fs-1 opacity-50"></i>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card bg-warning text-dark">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h4>{stats.visitsLast7Days.toLocaleString('cs-CZ')}</h4>
                  <p className="mb-0">Návštěv (7 dní)</p>
                </div>
                <i className="bi bi-people fs-1 opacity-50"></i>
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
                <Link to="/admin/races" className="btn btn-primary">
                  <i className="bi bi-plus-circle me-2"></i>
                  Nový závod
                </Link>
                <Link to="/admin/races" className="btn btn-outline-primary">
                  <i className="bi bi-list me-2"></i>
                  Spravovat závody
                </Link>
                <Link to="/admin/documents" className="btn btn-outline-success">
                  <i className="bi bi-upload me-2"></i>
                  Nahrát dokumenty
                </Link>
                <Link to="/admin/categories" className="btn btn-outline-warning">
                  <i className="bi bi-tag me-2"></i>
                  Správa kategorií
                </Link>
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