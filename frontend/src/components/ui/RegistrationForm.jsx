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

                <div className="row">
                    {/* Formulář vlevo */}
                    <div className="col-lg-7">
                        <form onSubmit={registration.handleSubmit}>
                            <RegistrationFormFields 
                                formData={registration.formData}
                                updateField={registration.updateField}
                                clubs={registration.clubs}
                            />

                            {/* Submit tlačítka */}
                            <div className="d-flex gap-2 justify-content-end mt-3">
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
                                    Registrovat závodníka
                                </button>
                            </div>
                        </form>

                        {/* Informační text */}
                        <div className="mt-3 p-2 bg-light rounded">
                            <small className="text-muted">
                                <strong>Tip:</strong> Klikněte na závodníka vpravo pro automatické vyplnění formuláře.
                            </small>
                        </div>
                    </div>

                    {/* Seznam závodníků vpravo */}
                    <div className="col-lg-5">
                        <RacerSearchResults 
                            filteredRacers={registration.filteredRacers}
                            isSearching={registration.isSearching}
                            selectExistingRacer={registration.selectExistingRacer}
                            getSexLabel={registration.getSexLabel}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}