import React from 'react';

const RaceForm = ({ 
    showForm,
    setShowForm,
    editingRace,
    formData,
    setFormData,
    loading,
    arealSearch,
    arealSuggestions,
    organizerSearch,
    organizerSuggestions,
    raceNumberPreview,
    seasonPreview,
    propositionDocuments,
    resultsDocuments,
    availableDocuments,
    handleArealSearch,
    handleOrganizerSearch,
    selectAreal,
    selectOrganizer,
    generateRaceNumberLocal,
    handleSubmit,
    resetForm
}) => {
    if (!showForm) return null;

    return (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <div className="modal-dialog modal-xl">
                <div className="modal-content">
                    <form onSubmit={handleSubmit}>
                        <div className="modal-header">
                            <h5 className="modal-title">
                                {editingRace ? 'Upravit závod' : 'Přidat nový závod'}
                            </h5>
                            <button 
                                type="button" 
                                className="btn-close" 
                                onClick={() => {
                                    setShowForm(false);
                                    resetForm();
                                }}
                            ></button>
                        </div>
                        
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
                                                setFormData(prev => ({...prev, datum: e.target.value}));
                                                if (e.target.value && !editingRace) {
                                                    try {
                                                        const result = generateRaceNumberLocal(e.target.value);
                                                        if (result) {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                raceNr: result.raceNr,
                                                                season_id: result.seasonId
                                                            }));
                                                        }
                                                    } catch (error) {
                                                        console.error('Error generating race number:', error);
                                                    }
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
                                        <label className="form-label">Sezóna (automatická)</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={seasonPreview}
                                            readOnly
                                            placeholder="Automaticky podle data"
                                        />
                                        <div className="form-text">Sezóna se určí podle data (srpen-červenec)</div>
                                    </div>
                                </div>
                            </div>

                            <div className="row">
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Areál *</label>
                                        <div className="position-relative">
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={arealSearch}
                                                onChange={(e) => handleArealSearch(e.target.value)}
                                                placeholder="Začněte psát název areálu..."
                                                required
                                            />
                                            {arealSuggestions.length > 0 && (
                                                <div className="position-absolute w-100 bg-white border rounded-bottom shadow-sm" style={{zIndex: 1000, top: '100%'}}>
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
                                </div>
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Organizátor *</label>
                                        <div className="position-relative">
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={organizerSearch}
                                                onChange={(e) => handleOrganizerSearch(e.target.value)}
                                                placeholder="Začněte psát název organizátora..."
                                                required
                                            />
                                            {organizerSuggestions.length > 0 && (
                                                <div className="position-absolute w-100 bg-white border rounded-bottom shadow-sm" style={{zIndex: 1000, top: '100%'}}>
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
                                            <option value="">Bez propozic</option>
                                            {propositionDocuments.map(doc => (
                                                <option key={doc.id} value={doc.id}>
                                                    {doc.original_filename}
                                                </option>
                                            ))}
                                            {availableDocuments.filter(doc => 
                                                !propositionDocuments.some(p => p.id === doc.id)
                                            ).map(doc => (
                                                <option key={doc.id} value={doc.id}>
                                                    {doc.original_filename} (ostatní)
                                                </option>
                                            ))}
                                        </select>
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
                                            <option value="">Bez výsledků</option>
                                            {resultsDocuments.map(doc => (
                                                <option key={doc.id} value={doc.id}>
                                                    {doc.original_filename}
                                                </option>
                                            ))}
                                            {availableDocuments.filter(doc => 
                                                !resultsDocuments.some(r => r.id === doc.id)
                                            ).map(doc => (
                                                <option key={doc.id} value={doc.id}>
                                                    {doc.original_filename} (ostatní)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="row">
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <div className="form-check">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id="registration"
                                                checked={formData.registration}
                                                onChange={(e) => setFormData(prev => ({...prev, registration: e.target.checked}))}
                                            />
                                            <label className="form-check-label" htmlFor="registration">
                                                Povolit registrace
                                            </label>
                                        </div>
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
                                    editingRace ? 'Aktualizovat' : 'Vytvořit'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RaceForm;