import React from 'react';

const RegistrationFormFields = ({
    formData,
    updateField,
    clubs
}) => {
    return (
        <>
            {/* Základní údaje */}
            <div className="row g-2 mb-3">
                <div className="col-md-6">
                    <label className="form-label">
                        <span className="bi bi-person"></span>
                        Jméno <span className="text-danger">*</span>
                    </label>
                    <input 
                        type="text"
                        className="form-control" 
                        placeholder="Zadejte jméno" 
                        value={formData.name} 
                        onChange={e => updateField('name', e.target.value)}
                    />
                </div>
                <div className="col-md-6">
                    <label className="form-label">
                        <span className="bi bi-person"></span>
                        Příjmení <span className="text-danger">*</span>
                    </label>
                    <input 
                        type="text"
                        className="form-control" 
                        placeholder="Zadejte příjmení" 
                        value={formData.surname} 
                        onChange={e => updateField('surname', e.target.value)}
                    />
                </div>
            </div>

            <div className="row g-2 mb-3">
                <div className="col-md-4">
                    <label className="form-label">
                        <span className="bi bi-calendar3"></span>
                        Rok narození <span className="text-danger">*</span>
                    </label>
                    <input 
                        type="number" 
                        className="form-control"
                        placeholder="YYYY" 
                        value={formData.year} 
                        onChange={e => updateField('year', Number(e.target.value))}
                        min="1900"
                        max={new Date().getFullYear()}
                    />
                </div>
                <div className="col-md-4">
                    <label className="form-label">
                        <span className="bi bi-gender-ambiguous"></span>
                        Pohlaví <span className="text-danger">*</span>
                    </label>
                    <select 
                        className="form-select" 
                        value={formData.sex} 
                        onChange={e => updateField('sex', Number(e.target.value))}
                    >
                        <option value={1}>Muž</option>
                        <option value={2}>Žena</option>
                    </select>
                </div>
                <div className="col-md-4">
                    <label className="form-label">
                        <span className="bi bi-building"></span>
                        Klub <span className="text-danger">*</span>
                    </label>
                    <input 
                        list="clubs"
                        className="form-control" 
                        placeholder="Zadejte název klubu" 
                        value={formData.club} 
                        onChange={e => updateField('club', e.target.value)}
                    />
                    <datalist id="clubs">
                        {clubs.map(club => (
                            <option key={club.id} value={club.name} />
                        ))}
                    </datalist>
                </div>
            </div>

            {/* Kontaktní údaje (nepovinné) */}
            <div className="row g-2 mb-3">
                <div className="col-md-4">
                    <label className="form-label">
                        <span className="bi bi-telephone"></span>
                        Telefon
                    </label>
                    <input 
                        type="tel"
                        className="form-control" 
                        placeholder="+420 123 456 789" 
                        value={formData.telefon} 
                        onChange={e => updateField('telefon', e.target.value)}
                    />
                </div>
                <div className="col-md-4">
                    <label className="form-label">
                        <span className="bi bi-envelope"></span>
                        Email
                    </label>
                    <input 
                        type="email"
                        className="form-control" 
                        placeholder="vas@email.cz" 
                        value={formData.email} 
                        onChange={e => updateField('email', e.target.value)}
                    />
                </div>
                <div className="col-md-4">
                    <label className="form-label">
                        <span className="bi bi-card-text"></span>
                        SLČR ID
                    </label>
                    <input 
                        type="text"
                        className="form-control" 
                        placeholder="Číslo licence" 
                        value={formData.slcr_id} 
                        onChange={e => updateField('slcr_id', e.target.value)}
                    />
                </div>
            </div>
        </>
    );
};

export default RegistrationFormFields;