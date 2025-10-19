import React from 'react';
import { useRaceManagement } from '../../hooks/useRaceManagement.js';
import RaceFilters from './race/RaceFilters.jsx';
import RaceTable from './race/RaceTable.jsx';
import RaceForm from './race/RaceForm.jsx';

const RaceManagement = () => {
    const raceManagement = useRaceManagement();

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h1>
                            <i className="bi bi-trophy me-2"></i>
                            Správa závodů
                        </h1>
                    </div>

                    <RaceFilters 
                        seasonFilter={raceManagement.seasonFilter}
                        setSeasonFilter={raceManagement.setSeasonFilter}
                        availableSeasons={raceManagement.availableSeasons}
                        setShowForm={raceManagement.setShowForm}
                        error={raceManagement.error}
                        success={raceManagement.success}
                        setError={raceManagement.setError}
                        setSuccess={raceManagement.setSuccess}
                    />

                    <RaceTable 
                        races={raceManagement.races}
                        availableDocuments={raceManagement.availableDocuments}
                        editRace={raceManagement.editRace}
                        deleteRace={raceManagement.deleteRace}
                        toggleRegistration={raceManagement.toggleRegistration}
                        downloadRegistrationsCsv={raceManagement.downloadRegistrationsCsv}
                    />

                    <RaceForm 
                        showForm={raceManagement.showForm}
                        setShowForm={raceManagement.setShowForm}
                        editingRace={raceManagement.editingRace}
                        formData={raceManagement.formData}
                        setFormData={raceManagement.setFormData}
                        loading={raceManagement.loading}
                        arealSearch={raceManagement.arealSearch}
                        arealSuggestions={raceManagement.arealSuggestions}
                        organizerSearch={raceManagement.organizerSearch}
                        organizerSuggestions={raceManagement.organizerSuggestions}
                        propositionSearch={raceManagement.propositionSearch}
                        propositionSuggestions={raceManagement.propositionSuggestions}
                        resultsSearch={raceManagement.resultsSearch}
                        resultsSuggestions={raceManagement.resultsSuggestions}
                        raceNumberPreview={raceManagement.raceNumberPreview}
                        seasonPreview={raceManagement.seasonPreview}
                        propositionDocuments={raceManagement.propositionDocuments}
                        resultsDocuments={raceManagement.resultsDocuments}
                        availableDocuments={raceManagement.availableDocumentsOnly}
                        handleArealSearch={raceManagement.handleArealSearch}
                        handleOrganizerSearch={raceManagement.handleOrganizerSearch}
                        handlePropositionSearch={raceManagement.handlePropositionSearch}
                        handleResultsSearch={raceManagement.handleResultsSearch}
                        selectAreal={raceManagement.selectAreal}
                        selectOrganizer={raceManagement.selectOrganizer}
                        selectPropositionDocument={raceManagement.selectPropositionDocument}
                        selectResultsDocument={raceManagement.selectResultsDocument}
                        clearPropositionDocument={raceManagement.clearPropositionDocument}
                        clearResultsDocument={raceManagement.clearResultsDocument}
                        generateRaceNumberLocal={raceManagement.generateRaceNumberLocal}
                        handleSubmit={raceManagement.handleSubmit}
                        resetForm={raceManagement.resetForm}
                    />
                </div>
            </div>
        </div>
    );
};

export default RaceManagement;