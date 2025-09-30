import React from 'react';

const RacerSearchResults = ({
    filteredRacers,
    isSearching,
    selectExistingRacer,
    getSexLabel,
    getAgeCategory
}) => {
    if (isSearching) {
        return (
            <div className="alert alert-info d-flex align-items-center">
                <div className="spinner-border spinner-border-sm me-2" role="status">
                    <span className="visually-hidden">Hledám...</span>
                </div>
                Hledám podobné závodníky...
            </div>
        );
    }

    if (filteredRacers.length === 0) {
        return null;
    }

    return (
        <div className="alert alert-warning">
            <h6 className="alert-heading">
                <span className="bi bi-search"></span>
                Nalezeni podobní závodníci ({filteredRacers.length})
            </h6>
            <p className="mb-2">
                Před vytvořením nové registrace zkontrolujte, zda se nejedná o již existujícího závodníka:
            </p>
            
            <div className="row">
                {filteredRacers.slice(0, 6).map(racer => (
                    <div key={racer.id} className="col-md-6 mb-2">
                        <div className="card border-warning">
                            <div className="card-body p-2">
                                <h6 className="card-title mb-1">
                                    {racer.name} {racer.surname}
                                </h6>
                                <div className="small text-muted mb-2">
                                    <div>
                                        <strong>Rok:</strong> {racer.year} • 
                                        <strong>Pohlaví:</strong> {getSexLabel(racer.sex)} • 
                                        <strong>Kategorie:</strong> {getAgeCategory(racer.year)}
                                    </div>
                                    {racer.club_name && (
                                        <div><strong>Klub:</strong> {racer.club_name}</div>
                                    )}
                                    {racer.slcr_id && (
                                        <div><strong>SLČR ID:</strong> {racer.slcr_id}</div>
                                    )}
                                </div>
                                <button 
                                    type="button"
                                    className="btn btn-sm btn-warning"
                                    onClick={() => selectExistingRacer(racer)}
                                >
                                    <span className="bi bi-person-check"></span>
                                    Vybrat tohoto závodníka
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredRacers.length > 6 && (
                <div className="text-muted small mt-2">
                    ... a dalších {filteredRacers.length - 6} závodníků
                </div>
            )}
        </div>
    );
};

export default RacerSearchResults;