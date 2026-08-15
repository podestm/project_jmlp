import { OWNER, ROLE } from '../../../config/attachmentsApi.js';
import AttachmentManager from '../attachments/AttachmentManager.jsx';

// Závod má právě dvě role dokumentů, od každé nejvýše jeden - hlídá to
// i backend (ATTACHMENT_ROLES_BY_OWNER / ATTACHMENT_EXCLUSIVE_GROUPS).
const RACE_ROLES = [ROLE.propozice, ROLE.vysledky];

const RaceForm = ({
    showForm,
    setShowForm,
    editingRace,
    formData,
    setFormData,
    loading,
    arealSearch,
    arealSuggestions,
    organizerSearch,
    organizerSuggestions,
    raceNumberPreview,
    seasonPreview,
    handleArealSearch,
    handleOrganizerSearch,
    selectAreal,
    selectOrganizer,
    generateRaceNumberLocal,
    handleSubmit,
    resetForm
}) => {
    if (!showForm) return null;

    return (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <div className="modal-dialog modal-xl">
                <div className="modal-content">
                    <form onSubmit={handleSubmit}>
                        <div className="modal-header">
                            <h5 className="modal-title">
                                {editingRace ? 'Upravit závod' : 'Přidat nový závod'}
                            </h5>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={() => {
                                    setShowForm(false);
                                    resetForm();
                                }}
                            ></button>
                        </div>

                        <div className="modal-body">
                            <div className="row">
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Datum závodu *</label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={formData.datum}
                                            onChange={(e) => {
                                                setFormData(prev => ({...prev, datum: e.target.value}));
                                                if (e.target.value) {
                                                    try {
                                                        const result = generateRaceNumberLocal(e.target.value);
                                                        if (result) {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                race_nr: result.race_nr,
                                                                season_id: result.seasonId
                                                            }));
                                                        }
                                                    } catch (error) {
                                                        console.error('Error generating race number:', error);
                                                    }
                                                }
                                            }}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Číslo závodu (automatické)</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={raceNumberPreview}
                                            readOnly
                                            placeholder="Vyberte datum pro automatické generování"
                                        />
                                        <div className="form-text">Číslo se automaticky vygeneruje podle data</div>
                                    </div>
                                </div>
                            </div>

                            <div className="row">
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Sezóna (automatická)</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={seasonPreview}
                                            readOnly
                                            placeholder="Automaticky podle data"
                                        />
                                        <div className="form-text">Sezóna se určí podle data (srpen-červenec)</div>
                                    </div>
                                </div>
                            </div>

                            <div className="row">
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Areál *</label>
                                        <div className="position-relative">
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={arealSearch}
                                                onChange={(e) => handleArealSearch(e.target.value)}
                                                placeholder="Začněte psát název areálu..."
                                                required
                                            />
                                            {arealSuggestions.length > 0 && (
                                                <div className="position-absolute w-100 bg-white border rounded-bottom shadow-sm" style={{zIndex: 1000, top: '100%'}}>
                                                    {arealSuggestions.map((areal, index) => (
                                                        <div
                                                            key={index}
                                                            className="p-2 border-bottom cursor-pointer hover-bg-light"
                                                            onClick={() => selectAreal(areal)}
                                                            style={{cursor: 'pointer'}}
                                                        >
                                                            {areal.name}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Organizátor *</label>
                                        <div className="position-relative">
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={organizerSearch}
                                                onChange={(e) => handleOrganizerSearch(e.target.value)}
                                                placeholder="Začněte psát název organizátora..."
                                                required
                                            />
                                            {organizerSuggestions.length > 0 && (
                                                <div className="position-absolute w-100 bg-white border rounded-bottom shadow-sm" style={{zIndex: 1000, top: '100%'}}>
                                                    {organizerSuggestions.map((organizer, index) => (
                                                        <div
                                                            key={index}
                                                            className="p-2 border-bottom cursor-pointer hover-bg-light"
                                                            onClick={() => selectOrganizer(organizer)}
                                                            style={{cursor: 'pointer'}}
                                                        >
                                                            {organizer.name}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/*
                              Dokumenty se nahrávají rovnou k závodu přes přílohy - formulář
                              o souborech nic neví a neposílá je s ostatními poli. U nového
                              závodu ještě není ownerId, komponenta si to ošetří sama.
                            */}
                            <div className="row">
                                <div className="col-12 mb-3">
                                    <AttachmentManager
                                        ownerType={OWNER.race}
                                        ownerId={editingRace?.id || null}
                                        roles={RACE_ROLES}
                                    />
                                </div>
                            </div>

                            <div className="row">
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <div className="form-check">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id="registration"
                                                checked={formData.registration}
                                                onChange={(e) => setFormData(prev => ({...prev, registration: e.target.checked}))}
                                            />
                                            <label className="form-check-label" htmlFor="registration">
                                                Povolit registrace
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <div className="form-check">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id="suchySlalom"
                                                checked={formData.race_method_id === 2}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    race_method_id: e.target.checked ? 2 : 1
                                                }))}
                                            />
                                            <label className="form-check-label" htmlFor="suchySlalom">
                                                Suchý slalom
                                            </label>
                                        </div>
                                        <div className="form-text">Pokud nezaškrtnuto = závod na sněhu (default)</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                    setShowForm(false);
                                    resetForm();
                                }}
                            >
                                Zrušit
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                        Ukládám...
                                    </>
                                ) : (
                                    editingRace ? 'Aktualizovat' : 'Vytvořit'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RaceForm;
