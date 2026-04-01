import React from 'react';

const RegistrationFormFields = ({
    formData,
    updateField,
    clubs,
    showContactFields = true,
    fieldErrors = {},
}) => {
    // Funkce pro určení stylu input pole podle toho, jestli je vyplněno nebo v chybě
    const getInputStyle = (value, isInvalid = false) => {
        if (isInvalid) {
            return {
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--text-primary)',
                border: '1px solid #ef4444',
                transition: 'all 0.2s ease'
            };
        }
        const isFilled = value !== '' && value !== null && value !== undefined;
        return {
            background: isFilled ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.2)',
            color: isFilled ? 'var(--text-primary)' : 'rgba(255, 255, 255, 0.5)',
            border: isFilled ? '1px solid rgba(255, 107, 0, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
            transition: 'all 0.2s ease'
        };
    };

    // Globální styl pro placeholdery a select
    const placeholderStyles = `
        .registration-input::placeholder {
            color: rgba(255, 255, 255, 0.55) !important;
            opacity: 1 !important;
        }
        .registration-select option {
            color: #212529 !important;
            background: white !important;
        }
    `;

    return (
        <>
            <style>{placeholderStyles}</style>
            {/* Základní údaje */}
            <div className="row g-2 mb-3">
                <div className="col-md-6">
                    <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                        <span className="bi bi-person"></span>
                        Jméno <span className="text-danger">*</span>
                    </label>
                    <input
                        type="text"
                        className={`form-control registration-input${fieldErrors.name ? ' is-invalid' : ''}`}
                        placeholder="Zadejte jméno"
                        value={formData.name}
                        onChange={e => updateField('name', e.target.value)}
                        style={getInputStyle(formData.name, !!fieldErrors.name)}
                    />
                    {fieldErrors.name && (
                        <div className="invalid-feedback d-block" style={{ color: '#f87171' }}>
                            {fieldErrors.name}
                        </div>
                    )}
                </div>
                <div className="col-md-6">
                    <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                        <span className="bi bi-person"></span>
                        Příjmení <span className="text-danger">*</span>
                    </label>
                    <input
                        type="text"
                        className={`form-control registration-input${fieldErrors.surname ? ' is-invalid' : ''}`}
                        placeholder="Zadejte příjmení"
                        value={formData.surname}
                        onChange={e => updateField('surname', e.target.value)}
                        style={getInputStyle(formData.surname, !!fieldErrors.surname)}
                    />
                    {fieldErrors.surname && (
                        <div className="invalid-feedback d-block" style={{ color: '#f87171' }}>
                            {fieldErrors.surname}
                        </div>
                    )}
                </div>
            </div>

            <div className="row g-2 mb-3">
                <div className="col-md-4">
                    <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                        <span className="bi bi-calendar3"></span>
                        Rok narození <span className="text-danger">*</span>
                    </label>
                    <input
                        type="number"
                        className={`form-control registration-input${fieldErrors.year ? ' is-invalid' : ''}`}
                        placeholder="YYYY"
                        value={formData.year}
                        onChange={e => updateField('year', Number(e.target.value))}
                        min="1900"
                        max={new Date().getFullYear()}
                        style={getInputStyle(formData.year, !!fieldErrors.year)}
                    />
                    {fieldErrors.year && (
                        <div className="invalid-feedback d-block" style={{ color: '#f87171' }}>
                            {fieldErrors.year}
                        </div>
                    )}
                </div>
                <div className="col-md-4">
                    <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                        <span className="bi bi-gender-ambiguous"></span>
                        Pohlaví <span className="text-danger">*</span>
                    </label>
                    <select
                        className="form-select registration-select"
                        value={formData.sex}
                        onChange={e => updateField('sex', e.target.value === '' ? '' : Number(e.target.value))}
                        style={getInputStyle(formData.sex)}
                    >
                        <option value="" disabled>Vyberte pohlaví</option>
                        <option value={1}>Muž</option>
                        <option value={2}>Žena</option>
                    </select>
                </div>
                <div className="col-md-4">
                    <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                        <span className="bi bi-buildings"></span>
                        Klub <span className="text-danger">*</span>
                    </label>
                    <input
                        list="clubs"
                        className={`form-control registration-input${fieldErrors.club ? ' is-invalid' : ''}`}
                        placeholder="Zadejte název klubu"
                        value={formData.club}
                        onChange={e => updateField('club', e.target.value)}
                        style={getInputStyle(formData.club, !!fieldErrors.club)}
                    />
                    <datalist id="clubs">
                        {clubs.map(club => (
                            <option key={club.id} value={club.name} />
                        ))}
                    </datalist>
                    {fieldErrors.club && (
                        <div className="invalid-feedback d-block" style={{ color: '#f87171' }}>
                            {fieldErrors.club}
                        </div>
                    )}
                </div>
            </div>

            {/* Kontaktní údaje (nepovinné) */}
            <div className="row g-2 mb-3">
                {showContactFields && (
                    <>
                        <div className="col-md-4">
                            <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                                <span className="bi bi-telephone"></span>
                                Telefon
                            </label>
                            <input
                                type="tel"
                                className="form-control registration-input"
                                placeholder="+420 123 456 789"
                                value={formData.telefon}
                                onChange={e => updateField('telefon', e.target.value)}
                                style={getInputStyle(formData.telefon)}
                            />
                        </div>
                        <div className="col-md-4">
                            <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                                <span className="bi bi-envelope"></span>
                                Email
                            </label>
                            <input
                                type="email"
                                className="form-control registration-input"
                                placeholder="vas@email.cz"
                                value={formData.email}
                                onChange={e => updateField('email', e.target.value)}
                                style={getInputStyle(formData.email)}
                            />
                        </div>
                    </>
                )}
                <div className={showContactFields ? "col-md-4" : "col-md-4"}>
                    <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                        <span className="bi bi-card-text"></span>
                        ID závodníka
                    </label>
                    <input
                        type="text"
                        className="form-control registration-input"
                        placeholder="6 místné číslo"
                        value={formData.slcr_id}
                        onChange={e => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                            updateField('slcr_id', value);
                        }}
                        maxLength="6"
                        pattern="\d{0,6}"
                        style={getInputStyle(formData.slcr_id)}
                    />
                </div>
            </div>
        </>
    );
};

export default RegistrationFormFields;
