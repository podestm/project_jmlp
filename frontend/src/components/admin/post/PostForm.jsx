import React from 'react';

const PostForm = ({
    showForm,
    setShowForm,
    editingPost,
    formData,
    setFormData,
    availableFiles,
    getFileName,
    handleSubmit,
    resetForm
}) => {
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
                            onClick={() => {
                                setShowForm(false);
                                resetForm();
                            }}
                        ></button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="modal-body">
                            <div className="row">
                                <div className="col-md-8">
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
                                
                                <div className="col-md-4">
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

                                    <div className="mb-3">
                                        <label className="form-label">Obrázek</label>
                                        <select
                                            className="form-select"
                                            value={formData.image_file_id}
                                            onChange={(e) => setFormData({...formData, image_file_id: e.target.value})}
                                        >
                                            <option value="">Žádný obrázek</option>
                                            {availableFiles?.images?.map(image => (
                                                <option key={image.id} value={image.id}>
                                                    {image.original_filename}
                                                </option>
                                            )) || []}
                                        </select>
                                        {formData.image_file_id && (
                                            <div className="form-text">
                                                Vybraný: {getFileName(formData.image_file_id, 'image')}
                                            </div>
                                        )}
                                    </div>

                                    {formData.image_file_id && (
                                        <div className="mb-3">
                                            <label className="form-label">Pozice obrázku</label>
                                            <select
                                                className="form-select"
                                                value={formData.image_position}
                                                onChange={(e) => setFormData({...formData, image_position: e.target.value})}
                                            >
                                                <option value="left">Vlevo</option>
                                                <option value="right">Vpravo</option>
                                                <option value="center">Na střed</option>
                                                <option value="top">Nahoře</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <label className="form-label">Dokument</label>
                                        <select
                                            className="form-select"
                                            value={formData.document_file_id}
                                            onChange={(e) => setFormData({...formData, document_file_id: e.target.value})}
                                        >
                                            <option value="">Žádný dokument</option>
                                            {availableFiles?.documents?.map(doc => (
                                                <option key={doc.id} value={doc.id}>
                                                    {doc.original_filename}
                                                </option>
                                            )) || []}
                                        </select>
                                        {formData.document_file_id && (
                                            <div className="form-text">
                                                Vybraný: {getFileName(formData.document_file_id, 'document')}
                                            </div>
                                        )}
                                    </div>

                                    <div className="card">
                                        <div className="card-header">
                                            <h6 className="card-title mb-0">📁 Správa souborů</h6>
                                        </div>
                                        <div className="card-body">
                                            <div className="d-grid gap-2">
                                                <a 
                                                    href="/admin/documents" 
                                                    target="_blank" 
                                                    className="btn btn-sm btn-outline-primary"
                                                    title="Otevřít správu dokumentů v novém okně"
                                                >
                                                    <i className="bi bi-folder-plus me-1"></i>
                                                    Spravovat soubory
                                                </a>
                                            </div>
                                            <div className="form-text mt-2">
                                                Můžete nahrát nové soubory v Správě dokumentů
                                            </div>
                                        </div>
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