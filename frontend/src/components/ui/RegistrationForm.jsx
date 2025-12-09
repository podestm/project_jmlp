import React from 'react';
import { useRegistration } from '../../hooks/useRegistration.js';
import RegistrationFormFields from './registration/RegistrationFormFields.jsx';
import RacerSearchResults from './registration/RacerSearchResults.jsx';
import RegistrationMessage from './registration/RegistrationMessage.jsx';

export default function RegistrationForm({ raceId, onSuccess }) {
    const registration = useRegistration(raceId, onSuccess);

    return (
        <div className="card" style={{
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
            <div className="card-header" style={{
                background: 'linear-gradient(135deg, var(--sunset-orange) 0%, #e65a00 100%)',
                color: 'white',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                padding: '1rem 1.25rem'
            }}>
                <h5 className="card-title mb-0">
                    <span className="bi bi-person-plus me-2"></span>
                    Registrovat závodníka
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
                                    className="btn"
                                    onClick={registration.resetForm}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.2)',
                                        color: '#ef4444',
                                        border: '1px solid #ef4444',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#ef4444';
                                        e.currentTarget.style.color = 'white';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                        e.currentTarget.style.color = '#ef4444';
                                    }}
                                >
                                    <span className="bi bi-x-circle me-1"></span>
                                    Vymazat formulář
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn"
                                    style={{
                                        background: 'linear-gradient(135deg, var(--sunset-orange) 0%, #e65a00 100%)',
                                        color: 'white',
                                        border: 'none',
                                        fontWeight: '500'
                                    }}
                                >
                                    <span className="bi bi-check-circle me-1"></span>
                                    Registrovat závodníka
                                </button>
                            </div>
                        </form>

                        {/* Informační text */}
                        <div className="mt-3 p-2 rounded" style={{
                            background: 'rgba(255, 107, 0, 0.1)',
                            border: '1px solid rgba(255, 107, 0, 0.3)'
                        }}>
                            <small style={{ color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--sunset-orange)' }}>Tip:</strong> Klikněte na závodníka vpravo pro automatické vyplnění formuláře.
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