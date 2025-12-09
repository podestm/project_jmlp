import React from 'react';

const PostTable = ({
    filteredPosts,
    loading,
    formatContent,
    formatDateTime,
    handleEdit,
    handleDelete
}) => {
    if (loading && filteredPosts.length === 0) {
        return (
            <div className="d-flex justify-content-center p-4">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Načítám...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-header">
                <h5 className="card-title mb-0">
                    📝 Posty ({filteredPosts.length})
                </h5>
            </div>
            <div className="card-body p-0">
                {filteredPosts.length === 0 ? (
                    <div className="text-center p-4">
                        <div className="text-muted">
                            <i className="bi bi-inbox display-1"></i>
                            <p className="mt-2">Žádné posty k zobrazení</p>
                        </div>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-hover mb-0 admin-table">
                            <thead className="bg-light">
                                <tr>
                                    <th className="fw-semibold">Nadpis</th>
                                    <th className="fw-semibold">Obsah</th>
                                    <th className="fw-semibold">Status</th>
                                    <th className="fw-semibold">Přílohy</th>
                                    <th className="fw-semibold">Vytvořeno</th>
                                    <th className="fw-semibold">Akce</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPosts.map((post, index) => (
                                    <tr key={post.id} className={index % 2 === 0 ? 'bg-white' : 'table-light'}>
                                        <td>
                                            <div className="fw-medium text-primary">
                                                {post.title}
                                            </div>
                                        </td>
                                        <td>
                                            <div 
                                                className="text-muted small"
                                                style={{
                                                    maxWidth: '300px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                dangerouslySetInnerHTML={{
                                                    __html: formatContent(post.content)
                                                }}
                                            ></div>
                                        </td>
                                        <td>
                                            <span className={`badge ${post.published ? 'bg-success' : 'bg-warning'}`}>
                                                {post.published ? 'Publikován' : 'Koncept'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="d-flex gap-1">
                                                {post.image_file_id && (
                                                    <span className="badge bg-info">
                                                        <i className="bi bi-image me-1"></i>
                                                        Obrázek
                                                    </span>
                                                )}
                                                {post.document_file_id && (
                                                    <span className="badge bg-primary">
                                                        <i className="bi bi-file-text me-1"></i>
                                                        Dokument
                                                    </span>
                                                )}
                                                {!post.image_file_id && !post.document_file_id && (
                                                    <span className="text-muted">—</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-muted small">
                                            {formatDateTime(post.created_at)}
                                        </td>
                                        <td>
                                            <div className="d-flex gap-1">
                                                <button
                                                    className="btn btn-sm btn-outline-primary"
                                                    onClick={() => handleEdit(post)}
                                                    title="Upravit"
                                                >
                                                    <i className="bi bi-pencil"></i>
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() => handleDelete(post.id)}
                                                    title="Smazat"
                                                >
                                                    <i className="bi bi-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PostTable;