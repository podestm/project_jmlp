import React from 'react';

const RaceFilters = ({ 
    seasonFilter, 
    setSeasonFilter, 
    availableSeasons, 
    setShowForm, 
    error, 
    success, 
    setError, 
    setSuccess 
}) => {
    return (
        <div className="row mb-4">
            <div className="col-md-6">
                <div className="d-flex gap-2">
                    <select 
                        className="form-select"
                        value={seasonFilter}
                        onChange={(e) => setSeasonFilter(e.target.value)}
                    >
                        <option value="">Všechny sezóny</option>
                        {availableSeasons.map(season => (
                            <option key={season} value={season}>
                                Sezóna {season}/{(season + 1).toString().slice(-2)}
                            </option>
                        ))}
                    </select>
                    <button 
                        className="btn btn-primary"
                        onClick={() => setShowForm(true)}
                    >
                        <i className="bi bi-plus-circle me-2"></i>
                        Přidat závod
                    </button>
                </div>
            </div>
            <div className="col-md-6">
                {error && (
                    <div className="alert alert-danger alert-dismissible">
                        {error}
                        <button 
                            type="button" 
                            className="btn-close" 
                            onClick={() => setError(null)}
                        ></button>
                    </div>
                )}
                {success && (
                    <div className="alert alert-success alert-dismissible">
                        {success}
                        <button 
                            type="button" 
                            className="btn-close" 
                            onClick={() => setSuccess(null)}
                        ></button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RaceFilters;