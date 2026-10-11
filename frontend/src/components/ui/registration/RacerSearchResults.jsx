import Icon from '../../ms/Icon/Icon.jsx';

const RacerSearchResults = ({
    filteredRacers,
    isSearching,
    selectExistingRacer,
    getSexLabel
}) => {
    return (
        <div className="h-100">
            <h6 className="text-muted mb-3">
                <Icon name="users" />
                Nalezení závodníci
            </h6>

            {isSearching && (
                <div className="text-center text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status">
                        <span className="visually-hidden">Hledám...</span>
                    </div>
                    Hledám...
                </div>
            )}

            {!isSearching && filteredRacers.length === 0 && (
                <div className="text-muted text-center">
                    <Icon name="search" />
                    <div>Začněte psát pro vyhledání závodníků</div>
                </div>
            )}

            {!isSearching && filteredRacers.length > 0 && (
                <div className="list-group list-group-flush" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {filteredRacers.slice(0, 20).map(racer => (
                        <button
                            key={racer.id}
                            type="button"
                            className="list-group-item list-group-item-action border-0 p-2"
                            onClick={() => selectExistingRacer(racer)}
                        >
                            <div className="d-flex justify-content-between align-items-start">
                                <div className="text-start">
                                    <div className="fw-bold text-dark">
                                        {racer.name} {racer.surname}
                                    </div>
                                    <div className="small text-muted">
                                        {racer.year} • {getSexLabel(racer.sex)}
                                        {racer.club_name && (
                                            <span> • {racer.club_name}</span>
                                        )}
                                        {racer.slcr_id && (
                                            <span> • SLČR {racer.slcr_id}</span>
                                        )}
                                    </div>
                                </div>
                                <Icon name="chevron-right" className="text-muted" />
                            </div>
                        </button>
                    ))}
                    
                    {filteredRacers.length > 20 && (
                        <div className="text-center text-muted p-2 small">
                            ... a dalších {filteredRacers.length - 20} závodníků
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RacerSearchResults;