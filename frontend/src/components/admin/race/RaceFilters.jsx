import Alert from '../../ui/Alert.jsx';
import Icon from '../../ms/Icon/Icon.jsx';

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
                        <Icon name="plus-circle" className="me-2" />
                        Přidat závod
                    </button>
                </div>
            </div>
            <div className="col-md-6">
                {error && (
                    <Alert 
                        type="danger" 
                        message={error}
                        onDismiss={() => setError(null)}
                    />
                )}
                {success && (
                    <Alert 
                        type="success" 
                        message={success}
                        onDismiss={() => setSuccess(null)}
                    />
                )}
            </div>
        </div>
    );
};

export default RaceFilters;