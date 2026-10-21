import React, { useState, useEffect } from 'react';
import { AdminAPI } from '../../config/api.js';
import SearchableSelect from '../ui/SearchableSelect.jsx';
import Alert from '../ui/Alert.jsx';

export default function ClubRequests() {
    const [requests, setRequests] = useState([]);
    const [clubs, setClubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Map of registration_id -> resolve UI state
    const [resolveState, setResolveState] = useState({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [reqs, cls] = await Promise.all([
                AdminAPI.get('/api/admin/clubs/requests'),
                AdminAPI.get('/api/admin/clubs/'),
            ]);
            setRequests(reqs);
            setClubs(cls);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getResolveState = (id) => resolveState[id] || { open: false, mode: 'existing', clubId: null, newName: '' };

    const setRS = (id, patch) => {
        setResolveState(prev => ({ ...prev, [id]: { ...getResolveState(id), ...patch } }));
    };

    const handleResolve = async (registrationId) => {
        const rs = getResolveState(registrationId);
        const payload = rs.mode === 'existing'
            ? { club_id: rs.clubId ? Number(rs.clubId) : null }
            : { new_club_name: rs.newName.trim() };

        try {
            await AdminAPI.post(`/api/admin/clubs/requests/${registrationId}/resolve`, payload);
            setRequests(prev => prev.filter(r => r.registration_id !== registrationId));
            setResolveState(prev => { const next = { ...prev }; delete next[registrationId]; return next; });
            window.dispatchEvent(new CustomEvent('club-request-resolved'));
        } catch (err) {
            alert(`Chyba: ${err.message}`);
        }
    };

    const formatDate = (iso) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Načítám...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-section">
            <div className="d-flex align-items-center mb-4 gap-3">
                <h2 className="mb-0">Žádosti o přiřazení klubu</h2>
                {requests.length > 0 && (
                    <span className="badge bg-warning text-dark fs-6">{requests.length}</span>
                )}
            </div>

            {error && (
                <Alert type="danger" message={error} onDismiss={() => setError(null)} />
            )}

            {requests.length === 0 ? (
                <div className="card border-0 shadow-sm">
                    <div className="card-body text-center py-5 text-muted">
                        <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '2.5rem' }}></i>
                        <p className="mt-3 mb-0 fs-5">Žádné nevyřízené žádosti</p>
                        <p className="text-muted small">Všechny žádosti o přiřazení klubu jsou vyřízeny.</p>
                    </div>
                </div>
            ) : (
                <div className="card border-0 shadow-sm">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th>Závodník</th>
                                    <th>Závod</th>
                                    <th>Datum registrace</th>
                                    <th>Poznámka závodníka</th>
                                    <th>Aktuální klub</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map(req => {
                                    const rs = getResolveState(req.registration_id);
                                    const canConfirm = rs.mode === 'existing'
                                        ? !!rs.clubId
                                        : rs.newName.trim().length > 0;

                                    return (
                                        <React.Fragment key={req.registration_id}>
                                            <tr>
                                                <td className="fw-semibold">{req.racer_name}</td>
                                                <td>{req.race_name}</td>
                                                <td className="text-nowrap text-muted small">{formatDate(req.registered_at)}</td>
                                                <td>
                                                    <span className="badge bg-light text-dark border" style={{ fontWeight: 'normal', fontSize: '0.85em' }}>
                                                        {req.club_request_note}
                                                    </span>
                                                </td>
                                                <td className="text-muted small">{req.current_club_name || ''}</td>
                                                <td>
                                                    <button
                                                        className={`btn btn-sm ${rs.open ? 'btn-secondary' : 'btn-primary'}`}
                                                        onClick={() => setRS(req.registration_id, { open: !rs.open })}
                                                    >
                                                        {rs.open ? 'Zrušit' : 'Vyřešit'}
                                                    </button>
                                                </td>
                                            </tr>
                                            {rs.open && (
                                                <tr className="table-light">
                                                    <td colSpan={6}>
                                                        <div className="p-3">
                                                            {/* Mode tabs */}
                                                            <div className="btn-group btn-group-sm mb-3" role="group">
                                                                <button
                                                                    type="button"
                                                                    className={`btn ${rs.mode === 'existing' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                                    onClick={() => setRS(req.registration_id, { mode: 'existing' })}
                                                                >
                                                                    Přiřadit existující klub
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className={`btn ${rs.mode === 'new' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                                    onClick={() => setRS(req.registration_id, { mode: 'new', newName: rs.newName || req.club_request_note })}
                                                                >
                                                                    Vytvořit nový klub
                                                                </button>
                                                            </div>

                                                            <div className="d-flex gap-2 align-items-end">
                                                                {rs.mode === 'existing' ? (
                                                                    <div style={{ minWidth: '300px' }}>
                                                                        <label className="form-label small mb-1">Vyberte klub</label>
                                                                        <SearchableSelect
                                                                            options={clubs.map(c => ({ value: c.id, label: c.name }))}
                                                                            value={rs.clubId}
                                                                            onChange={id => setRS(req.registration_id, { clubId: id })}
                                                                            placeholder="Hledat klub..."
                                                                            allLabel="— Vyberte klub —"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ minWidth: '300px' }}>
                                                                        <label className="form-label small mb-1">Název nového klubu</label>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-sm"
                                                                            value={rs.newName}
                                                                            onChange={e => setRS(req.registration_id, { newName: e.target.value })}
                                                                            placeholder="Název klubu..."
                                                                        />
                                                                    </div>
                                                                )}
                                                                <button
                                                                    className="btn btn-success btn-sm"
                                                                    disabled={!canConfirm}
                                                                    onClick={() => handleResolve(req.registration_id)}
                                                                >
                                                                    <i className="bi bi-check-lg me-1"></i>
                                                                    Potvrdit a přiřadit
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
