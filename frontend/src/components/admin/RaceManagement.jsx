import { useRaceManagement } from '../../hooks/useRaceManagement.js';
import { useConfirm } from '../../hooks/useConfirm.jsx';
import RaceFilters from './race/RaceFilters.jsx';
import RaceTable from './race/RaceTable.jsx';
import RaceForm from './race/RaceForm.jsx';

const RaceManagement = () => {
    // Hook sám nic nerenderuje, dialog proto vlastní tahle komponenta
    // a `confirm` posílá dolů (viz komentář v useConfirm.jsx).
    const { confirm, confirmElement } = useConfirm();
    const raceManagement = useRaceManagement({ confirm });

    return (
        <div className="container-fluid admin-section">
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
                        raceNumberPreview={raceManagement.raceNumberPreview}
                        seasonPreview={raceManagement.seasonPreview}
                        handleArealSearch={raceManagement.handleArealSearch}
                        handleOrganizerSearch={raceManagement.handleOrganizerSearch}
                        selectAreal={raceManagement.selectAreal}
                        selectOrganizer={raceManagement.selectOrganizer}
                        generateRaceNumberLocal={raceManagement.generateRaceNumberLocal}
                        handleSubmit={raceManagement.handleSubmit}
                        resetForm={raceManagement.resetForm}
                    />

                    {confirmElement}
                </div>
            </div>
        </div>
    );
};

export default RaceManagement;
