import React, { useState, useEffect } from 'react';
import { useAuth } from '../../config/auth.jsx';
import { API } from '../../config/api.js';

export default function RacerManagement() {
  const { token } = useAuth();
  const [racers, setRacers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRacer, setEditingRacer] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    sex: 1, // 1=muž, 2=žena
    birthYear: new Date().getFullYear() - 20,
    club_id: '',
    idSlcr: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [racersData, clubsData] = await Promise.all([
        API.get('/admin/racers', {}, { 'Authorization': `Bearer ${token}` }),
        API.get('/races/organizers')
      ]);
      
      setRacers(racersData);
      setClubs(clubsData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRacer) {
        // Update racer
        await API.put(`/admin/racers/${editingRacer.id}`, formData, {
          'Authorization': `Bearer ${token}`
        });
      } else {
        // Create racer
        await API.post('/admin/racers', formData, {
          'Authorization': `Bearer ${token}`
        });
      }
      
      // Reset form and reload data
      setFormData({
        firstName: '',
        lastName: '',
        sex: 1,
        birthYear: new Date().getFullYear() - 20,
        club_id: '',
        idSlcr: ''
      });
      setEditingRacer(null);
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error('Error saving racer:', err);
      setError(err.message);
    }
  };

  const handleEdit = (racer) => {
    setEditingRacer(racer);
    setFormData({
      firstName: racer.firstName || '',
      lastName: racer.lastName || '',
      sex: racer.sex || 1,
      birthYear: racer.birthYear || new Date().getFullYear() - 20,
      club_id: racer.club_id || '',
      idSlcr: racer.idSlcr || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (racerId) => {
    if (window.confirm('Opravdu chcete smazat tohoto závodníka?')) {
      try {
        await API.delete(`/admin/racers/${racerId}`, {
          'Authorization': `Bearer ${token}`
        });
        loadData();
      } catch (err) {
        console.error('Error deleting racer:', err);
        setError(err.message);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      sex: 1,
      birthYear: new Date().getFullYear() - 20,
      club_id: '',
      idSlcr: ''
    });
    setEditingRacer(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Načítám...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>Správa závodníků</h2>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="btn btn-primary"
            >
              <i className="bi bi-plus-circle me-2"></i>
              Nový závodník
            </button>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error}
            </div>
          )}

          <div className="card">
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Jméno</th>
                      <th>Příjmení</th>
                      <th>Pohlaví</th>
                      <th>Ročník</th>
                      <th>Oddíl</th>
                      <th>ID SLCR</th>
                      <th>Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {racers.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center text-muted">
                          Žádní závodníci nenalezeni
                        </td>
                      </tr>
                    ) : (
                      racers.map((racer) => (
                        <tr key={racer.id}>
                          <td>{racer.firstName}</td>
                          <td>{racer.lastName}</td>
                          <td>
                            <span className={`badge ${racer.sex === 1 ? 'bg-primary' : 'bg-success'}`}>
                              {racer.sex === 1 ? 'M' : 'Z'}
                            </span>
                          </td>
                          <td>{racer.birthYear}</td>
                          <td>{racer.club_name || 'Bez oddílu'}</td>
                          <td><code>{racer.idSlcr || 'N/A'}</code></td>
                          <td>
                            <div className="btn-group">
                              <button
                                onClick={() => handleEdit(racer)}
                                className="btn btn-sm btn-outline-primary"
                                title="Upravit"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                onClick={() => handleDelete(racer.id)}
                                className="btn btn-sm btn-outline-danger"
                                title="Smazat"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal formulář pro přidání/editaci závodníka */}
      {showForm && (
        <div className="modal show" style={{ display: 'block' }} tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingRacer ? 'Upravit závodníka' : 'Nový závodník'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowForm(false)}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Jméno *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.firstName}
                          onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                          required
                          placeholder="Jan"
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Příjmení *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.lastName}
                          onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                          required
                          placeholder="Novák"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="row">
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label className="form-label">Pohlaví</label>
                        <select
                          className="form-control"
                          value={formData.sex}
                          onChange={(e) => setFormData({...formData, sex: parseInt(e.target.value)})}
                        >
                          <option value={1}>Muž</option>
                          <option value={2}>Žena</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label className="form-label">Ročník narození</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.birthYear}
                          onChange={(e) => setFormData({...formData, birthYear: parseInt(e.target.value)})}
                          min="1940"
                          max={new Date().getFullYear()}
                          placeholder="1990"
                        />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label className="form-label">ID SLCR</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.idSlcr}
                          onChange={(e) => setFormData({...formData, idSlcr: e.target.value})}
                          maxLength="10"
                          placeholder="ABC1234567"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-12">
                      <div className="mb-3">
                        <label className="form-label">Oddíl</label>
                        <select
                          className="form-control"
                          value={formData.club_id}
                          onChange={(e) => setFormData({...formData, club_id: e.target.value})}
                        >
                          <option value="">Vyberte oddíl</option>
                          {clubs.map(club => (
                            <option key={club.id} value={club.id}>{club.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowForm(false)}
                  >
                    Zrušit
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingRacer ? 'Uložit změny' : 'Vytvořit závodníka'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showForm && <div className="modal-backdrop show"></div>}
    </div>
  );
}