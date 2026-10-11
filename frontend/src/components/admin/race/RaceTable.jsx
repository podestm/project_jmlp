import { formatSeason } from '../../../utils/season.js';
import Icon from '../../ms/Icon/Icon.jsx';

const RaceTable = ({
    races,
    editRace,
    deleteRace,
    toggleRegistration,
    downloadRegistrationsCsv
}) => {
    // Odkazy míří na veřejné trvalé adresy závodu, ne na konkrétní soubor -
    // po výměně přílohy zůstávají platné a admin si dokument rovnou otevře.
    const renderDocumentLinks = (race) => (
        <div className="d-flex flex-wrap gap-1">
            {race.proposition_file_id && (
                <a
                    className="badge bg-primary text-decoration-none"
                    href={`/races/${race.id}/proposition`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Propozice"
                >
                    <Icon name="file-text" className="me-1" />P
                </a>
            )}
            {race.results_file_id && (
                <a
                    className="badge bg-success text-decoration-none"
                    href={`/races/${race.id}/results`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Výsledky"
                >
                    <Icon name="file-text" className="me-1" />V
                </a>
            )}
            {!race.proposition_file_id && !race.results_file_id && (
                <span className="text-muted">-</span>
            )}
        </div>
    );

    if (races.length === 0) {
        return (
            <div className="text-center py-4">
                <Icon name="inbox" className="display-1 text-muted" />
                <p className="text-muted mt-2">Žádné závody nebyly nalezeny</p>
            </div>
        );
    }

    return (
        <div className="table-responsive">
            <table className="table table-striped table-hover">
                <thead className="table-dark">
                    <tr>
                        <th>Datum</th>
                        <th>Číslo</th>
                        <th>Sezóna</th>
                        <th>Areál</th>
                        <th>Organizátor</th>
                        <th>Registrace</th>
                        <th>Přihlášených</th>
                        <th>Dokumenty</th>
                        <th>Akce</th>
                    </tr>
                </thead>
                <tbody>
                    {races.map(race => (
                        <tr key={race.id}>
                            <td>
                                <strong>{new Date(race.datum).toLocaleDateString('cs-CZ')}</strong>
                            </td>
                            <td>
                                <code className="bg-light px-2 py-1 rounded">
                                    {race.race_nr}
                                </code>
                                {race.is_final && (
                                    <span className="badge bg-warning text-dark ms-2" title="Finálový závod poháru">Finále</span>
                                )}
                            </td>
                            <td>
                                <span className="badge bg-secondary">
                                    {formatSeason(race.season_id)}
                                </span>
                            </td>
                            <td>{race.areal_name || '-'}</td>
                            <td>{race.organizer_name || '-'}</td>
                            <td>
                                <button 
                                    className={`btn btn-sm ${race.registration ? 'btn-success' : 'btn-outline-secondary'}`}
                                    onClick={() => toggleRegistration(race.id)}
                                    title={race.registration ? 'Registrace povolena - klikněte pro zakázání' : 'Registrace zakázána - klikněte pro povolení'}
                                >
                                    <Icon name={race.registration ? 'success' : 'x-circle'} />
                                    {race.registration ? ' Aktivní' : ' Neaktivní'}
                                </button>
                            </td>
                            <td>
                                <span className="badge bg-info text-dark fs-6">
                                    {race.registrations_count || 0}
                                </span>
                            </td>
                            <td>{renderDocumentLinks(race)}</td>
                            <td>
                                <div className="btn-group btn-group-sm">
                                    <button 
                                        className="btn btn-outline-primary" 
                                        onClick={() => editRace(race)}
                                        aria-label="Upravit závod" title="Upravit závod"
                                    >
                                        <Icon name="pencil" />
                                    </button>
                                    <button 
                                        className="btn btn-outline-success" 
                                        onClick={() => downloadRegistrationsCsv(race.id, race.race_nr)}
                                        aria-label="Stáhnout registrace CSV" title="Stáhnout registrace CSV"
                                    >
                                        <Icon name="download" />
                                    </button>
                                    <button 
                                        className="btn btn-outline-danger" 
                                        onClick={() => deleteRace(race.id)}
                                        aria-label="Smazat závod" title="Smazat závod"
                                    >
                                        <Icon name="trash" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default RaceTable;