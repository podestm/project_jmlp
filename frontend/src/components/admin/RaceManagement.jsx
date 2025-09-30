import React, { useState, useEffect } from 'react';
import { useAuth } from '../../config/auth.jsx';
import { AdminAPI, API_CONFIG } from '../../config/api.js';
import { getSeasonIdForRace, formatSeason, generateRaceNumber } from '../../utils/season.js';

const RaceManagement = () => {
    const { token } = useAuth();
    const [races, setRaces] = useState([]);
    const [filteredRaces, setFilteredRaces] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingRace, setEditingRace] = useState(null);
    const [formData, setFormData] = useState({
        datum: '',
        raceNr: '',
        season_id: '',
        areal_id: '',
        organizer_id: '',
        registration: true,
        proposition_file_id: null,
        results_file_id: null
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    
    // Documents state
    const [availableDocuments, setAvailableDocuments] = useState([]);
    const [propositionDocuments, setPropositionDocuments] = useState([]);
    const [resultsDocuments, setResultsDocuments] = useState([]);
    
    // Autocomplete states
    const [arealSearch, setArealSearch] = useState('');
    const [arealSuggestions, setArealSuggestions] = useState([]);
    const [organizerSearch, setOrganizerSearch] = useState('');
    const [organizerSuggestions, setOrganizerSuggestions] = useState([]);
    const [raceNumberPreview, setRaceNumberPreview] = useState('');
    const [seasonPreview, setSeasonPreview] = useState('');
    
    // Filter states
    const [seasonFilter, setSeasonFilter] = useState('');
    const [availableSeasons, setAvailableSeasons] = useState([]);

    useEffect(() => {
        loadRaces();
        loadDocuments();
    }, []);

    useEffect(() => {
        filterRaces();
    }, [races, seasonFilter]);

    const loadDocuments = async () => {
        try {
            // Load all documents
            const data = await AdminAPI.get('/admin/files');
            setAvailableDocuments(data);
            
            // Filter documents by type
            setPropositionDocuments(data.filter(doc => 
                doc.file_type === 'proposition' || doc.original_filename.toLowerCase().includes('propozice')
            ));
            setResultsDocuments(data.filter(doc => 
                doc.file_type === 'results' || doc.original_filename.toLowerCase().includes('vysledky')
            ));
        } catch (err) {
            console.error('Error loading documents:', err);
        }
    };

    const loadRaces = async () => {
        try {
            setError(null);
            const data = await AdminAPI.get('/admin/races');
            setRaces(data);
            
            // Extract unique seasons from races
            const seasons = [...new Set(data.map(race => race.season_id))];
            setAvailableSeasons(seasons.sort((a, b) => b - a)); // Sort descending (newest first)
        } catch (err) {
            console.error('Error loading races:', err);
            setError('Chyba při načítání závodů');
        }
    };

    const filterRaces = () => {
        let filtered = races;

        if (seasonFilter) {
            filtered = filtered.filter(race => race.season_id === parseInt(seasonFilter));
        }

        setFilteredRaces(filtered);
    };

    const generateRaceNumberLocal = (date = null) => {
        const dateToUse = date || formData.datum;
        if (!dateToUse) return null;
        
        // Získáme season_id pro zadané datum
        const seasonId = getSeasonIdForRace(dateToUse);
        
        // Vygenerujeme číslo závodu na základě existujících závodů
        const raceNumber = generateRaceNumber(races, seasonId);
        
        // Formátujeme sezónu pro zobrazení
        const seasonDisplay = formatSeason(seasonId);
        
        setRaceNumberPreview(raceNumber);
        setSeasonPreview(seasonDisplay);
        
        // Předvyplníme pole ve formData
        setFormData(prev => ({
            ...prev,
            raceNr: raceNumber,
            season_id: seasonId
        }));
        
        return { raceNr: raceNumber, season_id: seasonId, seasonDisplay };
    };

    const searchAreals = async (query) => {
        if (query.length < 2) {
            setArealSuggestions([]);
            return;
        }
        
        try {
            const data = await AdminAPI.get(`/admin/races/autocomplete/areals?q=${encodeURIComponent(query)}`);
            setArealSuggestions(data);
        } catch (err) {
            console.error('Error searching areals:', err);
        }
    };

    const searchOrganizers = async (query) => {
        if (query.length < 2) {
            setOrganizerSuggestions([]);
            return;
        }
        
        try {
            const data = await AdminAPI.get(`/admin/races/autocomplete/organizers?q=${encodeURIComponent(query)}`);
            setOrganizerSuggestions(data);
        } catch (err) {
            console.error('Error searching organizers:', err);
        }
    };

    const handleArealSearch = (value) => {
        setArealSearch(value);
        searchAreals(value);
    };

    const handleOrganizerSearch = (value) => {
        setOrganizerSearch(value);
        searchOrganizers(value);
    };

    const selectAreal = async (areal) => {
        if (areal.id) {
            // Existing areal
            setFormData(prev => ({ ...prev, areal_id: areal.id }));
            setArealSearch(areal.name);
        } else {
            // Create new areal
            try {
                const newAreal = await AdminAPI.post('/admin/races/autocomplete/areals', { name: areal.name });
                setFormData(prev => ({ ...prev, areal_id: newAreal.id }));
                setArealSearch(newAreal.name);
            } catch (err) {
                console.error('Error creating areal:', err);
                setError('Chyba při vytváření areálu');
            }
        }
        setArealSuggestions([]);
    };

    const selectOrganizer = async (organizer) => {
        if (organizer.id) {
            // Existing organizer
            setFormData(prev => ({ ...prev, organizer_id: organizer.id }));
            setOrganizerSearch(organizer.name);
        } else {
            // Create new organizer
            try {
                const newOrganizer = await AdminAPI.post('/admin/races/autocomplete/organizers', { name: organizer.name });
                setFormData(prev => ({ ...prev, organizer_id: newOrganizer.id }));
                setOrganizerSearch(newOrganizer.name);
            } catch (err) {
                console.error('Error creating organizer:', err);
                setError('Chyba při vytváření organizátora');
            }
        }
        setOrganizerSuggestions([]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            let response;
            const submitData = { ...formData };
            
            // Convert empty strings to null for integer fields
            if (submitData.areal_id === '') submitData.areal_id = null;
            if (submitData.organizer_id === '') submitData.organizer_id = null;
            if (submitData.season_id === '') submitData.season_id = null;
            if (submitData.proposition_file_id === '') submitData.proposition_file_id = null;
            if (submitData.results_file_id === '') submitData.results_file_id = null;
            
            console.log('Submitting data:', submitData);
            
            if (editingRace) {
                response = await AdminAPI.put(`/admin/races/${editingRace.id}`, submitData);
            } else {
                response = await AdminAPI.post('/admin/races', submitData);
            }

            setShowForm(false);
            setEditingRace(null);
            resetForm();
            loadRaces();
            setSuccess(editingRace ? 'Závod byl úspěšně aktualizován' : 'Závod byl úspěšně vytvořen');
        } catch (err) {
            console.error('Error saving race:', err);
            setError(err.message || 'Chyba při ukládání závodu');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            datum: '',
            raceNr: '',
            season_id: '',
            areal_id: '',
            organizer_id: '',
            registration: true,
            proposition_file_id: null,
            results_file_id: null
        });
        setArealSearch('');
        setOrganizerSearch('');
        setRaceNumberPreview('');
        setSeasonPreview('');
        setArealSuggestions([]);
        setOrganizerSuggestions([]);
    };

    const handleEdit = (race) => {
        setEditingRace(race);
        setFormData({
            datum: race.datum,
            raceNr: race.raceNr,
            season_id: race.season_id,
            areal_id: race.areal_id,
            organizer_id: race.organizer_id,
            registration: race.registration,
            proposition_file_id: race.proposition_file_id,
            results_file_id: race.results_file_id
        });
        setArealSearch(race.areal_name || '');
        setOrganizerSearch(race.organizer_name || '');
        setRaceNumberPreview(race.raceNr);
        setSeasonPreview(`${Math.floor(race.season_id)}/${Math.floor(race.season_id) + 1}`);
        setShowForm(true);
    };

    const handleDelete = async (raceId) => {
        if (!window.confirm('Opravdu chcete smazat tento závod?')) return;

        try {
            await AdminAPI.delete(`/admin/races/${raceId}`);
            loadRaces();
            setSuccess('Závod byl úspěšně smazán');
        } catch (err) {
            console.error('Error deleting race:', err);
            setError(err.message || 'Chyba při mazání závodu');
        }
    };

    const toggleRegistration = async (raceId) => {
        try {
            await AdminAPI.post(`/admin/races/${raceId}/toggle-registration`);
            loadRaces();
            setSuccess('Stav registrace byl změněn');
        } catch (err) {
            console.error('Error toggling registration:', err);
            setError(err.message || 'Chyba při změně registrace');
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('cs-CZ');
    };

    const downloadRegistrationsCsv = async (raceId, raceNr) => {
        try {
            // Pro CSV download musíme použít přímý fetch místo AdminAPI
            const token = localStorage.getItem('admin_token');
            const response = await fetch(`${API_CONFIG.BASE_URL}/admin/races/${raceId}/export-csv`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Create blob from response
            const blob = await response.blob();
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `registrace_${raceNr}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            setSuccess('CSV soubor byl stažen');
        } catch (err) {
            console.error('Error downloading CSV:', err);
            setError('Chyba při stahování CSV souboru');
        }
    };

    const getDocumentName = (fileId) => {
        const doc = availableDocuments.find(d => d.id === fileId);
        return doc ? doc.original_filename : '';
    };

    const renderDocumentLinks = (race) => {
        const propositionDoc = race.proposition_file_id ? getDocumentName(race.proposition_file_id) : null;
        const resultsDoc = race.results_file_id ? getDocumentName(race.results_file_id) : null;
        
        return (
            <div className="d-flex flex-wrap gap-1">
                {propositionDoc && (
                    <span className="badge bg-primary" title={propositionDoc}>
                        <i className="bi bi-file-text me-1"></i>P
                    </span>
                )}
                {resultsDoc && (
                    <span className="badge bg-success" title={resultsDoc}>
                        <i className="bi bi-file-check me-1"></i>V
                    </span>
                )}
                {!propositionDoc && !resultsDoc && (
                    <span className="text-muted">—</span>
                )}
            </div>
        );
    };

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h2>Správa závodů</h2>
                        <button 
                            className="btn btn-primary"
                            onClick={() => setShowForm(true)}
                        >
                            <i className="bi bi-plus-lg me-2"></i>
                            Přidat závod
                        </button>
                    </div>

                    {/* Alerts */}
                    {error && (
                        <div className="alert alert-danger alert-dismissible fade show" role="alert">
                            {error}
                            <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                        </div>
                    )}

                    {success && (
                        <div className="alert alert-success alert-dismissible fade show" role="alert">
                            {success}
                            <button type="button" className="btn-close" onClick={() => setSuccess(null)}></button>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="row mb-3">
                        <div className="col-md-4">
                            <select
                                className="form-select"
                                value={seasonFilter}
                                onChange={(e) => setSeasonFilter(e.target.value)}
                            >
                                <option value="">Všechny sezóny</option>
                                {availableSeasons.map(seasonId => (
                                    <option key={seasonId} value={seasonId}>
                                        Sezóna {seasonId}/{seasonId + 1}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-8">
                            <div className="text-muted small">
                                Zobrazeno {filteredRaces.length} z {races.length} závodů
                            </div>
                        </div>
                    </div>

                    {/* Race Form Modal */}
                    {showForm && (
                        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                            <div className="modal-dialog modal-lg">
                                <div className="modal-content">
                                    <div className="modal-header">
                                        <h5 className="modal-title">
                                            {editingRace ? 'Upravit závod' : 'Přidat nový závod'}
                                        </h5>
                                        <button 
                                            type="button" 
                                            className="btn-close"
                                            onClick={() => {
                                                setShowForm(false);
                                                setEditingRace(null);
                                                resetForm();
                                            }}
                                        ></button>
                                    </div>
                                    <form onSubmit={handleSubmit}>
                                        <div className="modal-body">
                                            <div className="row">
                                                <div className="col-md-6">
                                                    <div className="mb-3">
                                                        <label className="form-label">Datum závodu *</label>
                                                        <input
                                                            type="date"
                                                            className="form-control"
                                                            value={formData.datum}
                                                            onChange={(e) => {
                                                                const date = e.target.value;
                                                                setFormData(prev => ({...prev, datum: date}));
                                                                
                                                                // Auto-generate race number and season if date is valid
                                                                if (date) {
                                                                    try {
                                                                        const result = generateRaceNumberLocal(date);
                                                                        if (result) {
                                                                            setRaceNumberPreview(result.raceNr);
                                                                            setSeasonPreview(result.seasonDisplay);
                                                                        }
                                                                    } catch (error) {
                                                                        console.error('Error generating race number:', error);
                                                                    }
                                                                } else {
                                                                    setRaceNumberPreview('');
                                                                    setSeasonPreview('');
                                                                }
                                                            }}
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div className="col-md-6">
                                                    <div className="mb-3">
                                                        <label className="form-label">Číslo závodu (automatické)</label>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            value={raceNumberPreview}
                                                            readOnly
                                                            placeholder="Vyberte datum pro automatické generování"
                                                        />
                                                        <div className="form-text">Číslo se automaticky vygeneruje podle data</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="row">
                                                <div className="col-md-6">
                                                    <div className="mb-3">
                                                        <label className="form-label">Sezona (automatická)</label>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            value={seasonPreview}
                                                            readOnly
                                                            placeholder="Automaticky podle data"
                                                        />
                                                        <div className="form-text">Sezona se určí podle data (srpen-červenec)</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="row">
                                                <div className="col-md-6">
                                                    <div className="mb-3 position-relative">
                                                        <label className="form-label">Areál *</label>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            value={arealSearch}
                                                            onChange={(e) => handleArealSearch(e.target.value)}
                                                            placeholder="Začněte psát název areálu..."
                                                            required
                                                        />
                                                        {arealSuggestions.length > 0 && (
                                                            <div className="position-absolute w-100 bg-white border rounded shadow-sm" style={{zIndex: 1000, top: '100%'}}>
                                                                {arealSuggestions.map((areal, index) => (
                                                                    <div 
                                                                        key={index}
                                                                        className="p-2 border-bottom cursor-pointer hover-bg-light"
                                                                        onClick={() => selectAreal(areal)}
                                                                        style={{cursor: 'pointer'}}
                                                                    >
                                                                        {areal.name}
                                                                    </div>
                                                                ))}
                                                                {arealSearch && !arealSuggestions.some(a => a.name.toLowerCase() === arealSearch.toLowerCase()) && (
                                                                    <div 
                                                                        className="p-2 text-primary cursor-pointer hover-bg-light"
                                                                        onClick={() => selectAreal({name: arealSearch})}
                                                                        style={{cursor: 'pointer'}}
                                                                    >
                                                                        <i className="bi bi-plus-circle me-2"></i>
                                                                        Vytvořit nový areál: "{arealSearch}"
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="col-md-6">
                                                    <div className="mb-3 position-relative">
                                                        <label className="form-label">Organizátor *</label>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            value={organizerSearch}
                                                            onChange={(e) => handleOrganizerSearch(e.target.value)}
                                                            placeholder="Začněte psát název organizátora..."
                                                            required
                                                        />
                                                        {organizerSuggestions.length > 0 && (
                                                            <div className="position-absolute w-100 bg-white border rounded shadow-sm" style={{zIndex: 1000, top: '100%'}}>
                                                                {organizerSuggestions.map((organizer, index) => (
                                                                    <div 
                                                                        key={index}
                                                                        className="p-2 border-bottom cursor-pointer hover-bg-light"
                                                                        onClick={() => selectOrganizer(organizer)}
                                                                        style={{cursor: 'pointer'}}
                                                                    >
                                                                        {organizer.name}
                                                                    </div>
                                                                ))}
                                                                {organizerSearch && !organizerSuggestions.some(o => o.name.toLowerCase() === organizerSearch.toLowerCase()) && (
                                                                    <div 
                                                                        className="p-2 text-primary cursor-pointer hover-bg-light"
                                                                        onClick={() => selectOrganizer({name: organizerSearch})}
                                                                        style={{cursor: 'pointer'}}
                                                                    >
                                                                        <i className="bi bi-plus-circle me-2"></i>
                                                                        Vytvořit nového organizátora: "{organizerSearch}"
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="row">
                                                <div className="col-12">
                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                        <h6 className="mb-0">Dokumenty</h6>
                                                        <a 
                                                            href="/admin/documents" 
                                                            target="_blank" 
                                                            className="btn btn-sm btn-outline-secondary"
                                                            title="Otevřít správu dokumentů v novém okně"
                                                        >
                                                            <i className="bi bi-folder-plus me-1"></i>
                                                            Spravovat dokumenty
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="row">
                                                <div className="col-md-6">
                                                    <div className="mb-3">
                                                        <label className="form-label">Propozice</label>
                                                        <select
                                                            className="form-select"
                                                            value={formData.proposition_file_id || ''}
                                                            onChange={(e) => setFormData(prev => ({...prev, proposition_file_id: e.target.value || null}))}
                                                        >
                                                            <option value="">Žádné propozice</option>
                                                            {propositionDocuments.map(doc => (
                                                                <option key={doc.id} value={doc.id}>
                                                                    {doc.original_filename}
                                                                </option>
                                                            ))}
                                                            {availableDocuments.filter(doc => 
                                                                !propositionDocuments.some(p => p.id === doc.id)
                                                            ).map(doc => (
                                                                <option key={doc.id} value={doc.id}>
                                                                    {doc.original_filename}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <div className="form-text">Vyberte soubor s propozicemi závodu</div>
                                                    </div>
                                                </div>
                                                <div className="col-md-6">
                                                    <div className="mb-3">
                                                        <label className="form-label">Výsledky</label>
                                                        <select
                                                            className="form-select"
                                                            value={formData.results_file_id || ''}
                                                            onChange={(e) => setFormData(prev => ({...prev, results_file_id: e.target.value || null}))}
                                                        >
                                                            <option value="">Žádné výsledky</option>
                                                            {resultsDocuments.map(doc => (
                                                                <option key={doc.id} value={doc.id}>
                                                                    {doc.original_filename}
                                                                </option>
                                                            ))}
                                                            {availableDocuments.filter(doc => 
                                                                !resultsDocuments.some(r => r.id === doc.id)
                                                            ).map(doc => (
                                                                <option key={doc.id} value={doc.id}>
                                                                    {doc.original_filename}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <div className="form-text">Vyberte soubor s výsledky závodu</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="row">
                                                <div className="col-md-12">
                                                    <div className="form-check">
                                                        <input
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            checked={formData.registration}
                                                            onChange={(e) => setFormData(prev => ({...prev, registration: e.target.checked}))}
                                                        />
                                                        <label className="form-check-label">
                                                            Registrace povolena
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="modal-footer">
                                            <button 
                                                type="button" 
                                                className="btn btn-secondary"
                                                onClick={() => {
                                                    setShowForm(false);
                                                    setEditingRace(null);
                                                    resetForm();
                                                }}
                                            >
                                                Zrušit
                                            </button>
                                            <button 
                                                type="submit" 
                                                className="btn btn-primary"
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                                        Ukládám...
                                                    </>
                                                ) : (
                                                    editingRace ? 'Upravit závod' : 'Přidat závod'
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Race List */}
                    <div className="card">
                        <div className="card-header">
                            <h5 className="card-title mb-0">Seznam závodů</h5>
                        </div>
                        <div className="card-body p-0">
                            {filteredRaces.length === 0 ? (
                                <div className="text-center p-4">
                                    <div className="text-muted">
                                        <i className="bi bi-inbox display-1"></i>
                                        <p className="mt-2">Žádné závody k zobrazení</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-hover mb-0">
                                        <thead className="bg-light">
                                            <tr>
                                                <th className="fw-semibold">Číslo závodu</th>
                                                <th className="fw-semibold">Datum</th>
                                                <th className="fw-semibold">Areál</th>
                                                <th className="fw-semibold">Organizátor</th>
                                                <th className="fw-semibold">Dokumenty</th>
                                                <th className="fw-semibold">Registrace</th>
                                                <th className="fw-semibold">Akce</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRaces.map((race, index) => (
                                                <tr key={race.id} className={index % 2 === 0 ? 'bg-white' : 'table-light'}>
                                                    <td>
                                                        {race.raceNr && (
                                                            <span className="badge bg-primary">{race.raceNr}</span>
                                                        )}
                                                    </td>
                                                    <td className="text-dark fw-medium">
                                                        {formatDate(race.datum)}
                                                    </td>
                                                    <td>
                                                        <div className="d-flex align-items-center">
                                                            <i className="bi bi-geo-alt-fill text-danger me-2"></i>
                                                            {race.areal_name || <em className="text-muted">Neurčeno</em>}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex align-items-center">
                                                            <i className="bi bi-buildings text-muted me-2"></i>
                                                            <small>{race.organizer_name || <em className="text-muted">Neurčeno</em>}</small>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {renderDocumentLinks(race)}
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${race.registration ? 'bg-success' : 'bg-secondary'}`}>
                                                            {race.registration ? 'Otevřená' : 'Uzavřená'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="btn-group btn-group-sm" role="group">
                                                            <button
                                                                className="btn btn-outline-success"
                                                                onClick={() => downloadRegistrationsCsv(race.id, race.raceNr)}
                                                                title="Stáhnout registrace (CSV)"
                                                            >
                                                                <i className="bi bi-download"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-outline-primary"
                                                                onClick={() => handleEdit(race)}
                                                                title="Upravit závod"
                                                            >
                                                                <i className="bi bi-pencil"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-outline-danger"
                                                                onClick={() => handleDelete(race.id)}
                                                                title="Smazat závod"
                                                            >
                                                                <i className="bi bi-trash"></i>
                                                            </button>
                                                            <button
                                                                className={`btn ${race.registration ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                                                onClick={() => toggleRegistration(race.id)}
                                                                title="Změnit stav registrace"
                                                            >
                                                                <i className={`bi ${race.registration ? 'bi-pause' : 'bi-play'}`}></i>
                                                            </button>
                                                        </div>
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
            </div>
        </div>
    );
};

export default RaceManagement;