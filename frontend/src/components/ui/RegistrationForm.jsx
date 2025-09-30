import React from 'react';
import { useRegistration } from '../../hooks/useRegistration.js';
import RegistrationFormFields from './registration/RegistrationFormFields.jsx';
import RacerSearchResults from './registration/RacerSearchResults.jsx';
import RegistrationMessage from './registration/RegistrationMessage.jsx';

export default function RegistrationForm({ raceId, onSuccess }) {
    const registration = useRegistration(raceId, onSuccess);

    return (
        <div className="card">
            <div className="card-header">
                <h5 className="card-title mb-0">
                    <span className="bi bi-person-plus"></span>
                    Registrace na závod
                </h5>
            </div>
            <div className="card-body">
                <RegistrationMessage 
                    msg={registration.msg}
                    setMsg={registration.setMsg}
                />

                <form onSubmit={registration.handleSubmit}>
                    <RegistrationFormFields 
                        formData={registration.formData}
                        updateField={registration.updateField}
                        clubs={registration.clubs}
                    />

                    <RacerSearchResults 
                        filteredRacers={registration.filteredRacers}
                        isSearching={registration.isSearching}
                        selectExistingRacer={registration.selectExistingRacer}
                        getSexLabel={registration.getSexLabel}
                        getAgeCategory={registration.getAgeCategory}
                    />

                    {/* Submit tlačítka */}
                    <div className="d-flex gap-2 justify-content-end">
                        <button 
                            type="button" 
                            className="btn btn-outline-secondary"
                            onClick={registration.resetForm}
                        >
                            <span className="bi bi-x-circle"></span>
                            Vymazat formulář
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-primary"
                        >
                            <span className="bi bi-check-circle"></span>
                            {registration.selectedRacer ? 'Registrovat existujícího' : 'Registrovat nového závodníka'}
                        </button>
                    </div>
                </form>

                {/* Informační text */}
                <div className="mt-3 p-2 bg-light rounded">
                    <small className="text-muted">
                        <strong>Tip:</strong> Systém automaticky vyhledává podobné závodníky podle jména, příjmení a klubu. 
                        Před registrací nového závodníka zkontrolujte, zda již není v databázi.
                    </small>
                </div>
            </div>
        </div>
    );
}