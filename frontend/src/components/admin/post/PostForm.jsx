import { useState } from 'react';
import { OWNER, ROLE } from '../../../config/attachmentsApi.js';
import AttachmentManager from '../attachments/AttachmentManager.jsx';
import Alert from '../../ui/Alert.jsx';

// Příspěvek má nejvýše jeden obrázek a nejvýše jeden dokument - obojí řeší
// jeden AttachmentManager, backend stejné omezení hlídá taky.
const POST_ROLES = [ROLE.image, ROLE.document];

const PostForm = ({
    showForm,
    editingPost,
    formData,
    setFormData,
    handleSubmit,
    closeForm,
    error,
    setError,
    success,
    setSuccess
}) => {
    // Pozice obrázku má smysl jen když nějaký obrázek připojený je. Stav
    // příloh zná AttachmentManager, proto si ho posílá zpátky přes onChange.
    const [hasImage, setHasImage] = useState(false);

    if (!showForm) return null;

    return (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <div className="modal-dialog modal-xl">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">
                            {editingPost ? 'Upravit post' : 'Nový post'}
                        </h5>
                        <button
                            type="button"
                            className="btn-close"
                            aria-label="Zavřít"
                            onClick={closeForm}
                        ></button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="modal-body">
                            {/* Hlášky stránky jsou pod oknem schované, proto se
                                výsledek uložení ukazuje i tady. */}
                            {error && (
                                <Alert type="danger" message={error} onDismiss={() => setError('')} />
                            )}
                            {success && (
                                <Alert key={success} type="success" message={success} onDismiss={() => setSuccess('')} />
                            )}
                            <div className="row">
                                <div className="col-lg-8">
                                    <div className="mb-3">
                                        <label className="form-label">Nadpis *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={formData.title}
                                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                                            required
                                            placeholder="Zadejte nadpis příspěvku..."
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label">Obsah *</label>
                                        <textarea
                                            className="form-control"
                                            rows={10}
                                            value={formData.content}
                                            onChange={(e) => setFormData({...formData, content: e.target.value})}
                                            required
                                            placeholder="Napište obsah příspěvku..."
                                        />
                                        <div className="form-text">
                                            Pro formátování textu můžete použít: **tučný text**, *kurzíva*
                                        </div>
                                    </div>
                                </div>

                                <div className="col-lg-4">
                                    <div className="mb-3">
                                        <div className="form-check">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id="published"
                                                checked={formData.published}
                                                onChange={(e) => setFormData({...formData, published: e.target.checked})}
                                            />
                                            <label className="form-check-label" htmlFor="published">
                                                Publikovat příspěvek
                                            </label>
                                        </div>
                                        <div className="form-text">
                                            Zaškrtněte pro okamžité zveřejnění
                                        </div>
                                    </div>

                                    <AttachmentManager
                                        ownerType={OWNER.post}
                                        ownerId={editingPost?.id || null}
                                        roles={POST_ROLES}
                                        title="Obrázek a dokument"
                                        stacked
                                        onChange={(items) => setHasImage(items.some((item) => item.role === ROLE.image))}
                                    />

                                    {hasImage && (
                                        <div className="mb-3">
                                            <label className="form-label">Pozice obrázku</label>
                                            <select
                                                className="form-select"
                                                value={formData.image_position}
                                                onChange={(e) => setFormData({...formData, image_position: e.target.value})}
                                            >
                                                <option value="left">Vlevo</option>
                                                <option value="right">Vpravo</option>
                                                <option value="top">Nahoře</option>
                                                <option value="none">Nezobrazovat</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={closeForm}
                            >
                                Zrušit
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                            >
                                {editingPost ? 'Aktualizovat post' : 'Vytvořit post'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PostForm;
