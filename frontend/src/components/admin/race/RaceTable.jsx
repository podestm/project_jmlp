import React from 'react';
import { formatSeason } from '../../../utils/season.js';

const RaceTable = ({ 
    races, 
    availableDocuments, 
    editRace, 
    deleteRace, 
    toggleRegistration, 
    downloadRegistrationsCsv 
}) => {
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
                        <i className="bi bi-file-text me-1"></i>V
                    </span>
                )}
                {!propositionDoc && !resultsDoc && (
                    <span className="text-muted">-</span>
                )}
            </div>
        );
    };

    if (races.length === 0) {
        return (
            <div className="text-center py-4">
                <i className="bi bi-inbox display-1 text-muted"></i>
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
                                    {race.raceNr}
                                </code>
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
                                    <i className={`bi ${race.registration ? 'bi-check-circle' : 'bi-x-circle'}`}></i>
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
                                        title="Upravit závod"
                                    >
                                        <i className="bi bi-pencil"></i>
                                    </button>
                                    <button 
                                        className="btn btn-outline-success" 
                                        onClick={() => downloadRegistrationsCsv(race.id, race.raceNr)}
                                        title="Stáhnout registrace CSV"
                                    >
                                        <i className="bi bi-download"></i>
                                    </button>
                                    <button 
                                        className="btn btn-outline-danger" 
                                        onClick={() => deleteRace(race.id)}
                                        title="Smazat závod"
                                    >
                                        <i className="bi bi-trash"></i>
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