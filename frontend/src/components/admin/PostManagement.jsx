import React, { useState, useEffect } from 'react';
import { AdminAPI } from '../../config/api';

function PostManagement() {
    const [posts, setPosts] = useState([]);
    const [filteredPosts, setFilteredPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        published: false,
        image_file_id: '',
        image_position: 'right',
        document_file_id: ''
    });
    const [availableFiles, setAvailableFiles] = useState({
        images: [],
        documents: []
    });

    useEffect(() => {
        loadPosts();
        loadAvailableFiles();
    }, []);

    useEffect(() => {
        filterPosts();
    }, [posts, searchTerm, statusFilter, selectedYear, selectedMonth]);

    const filterPosts = () => {
        let filtered = posts;

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(post =>
                post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                post.content.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filter by status
        if (statusFilter) {
            if (statusFilter === 'published') {
                filtered = filtered.filter(post => post.published);
            } else if (statusFilter === 'draft') {
                filtered = filtered.filter(post => !post.published);
            }
        }

        // Filter by year
        if (selectedYear) {
            filtered = filtered.filter(post => {
                const postYear = new Date(post.created_at).getFullYear().toString();
                return postYear === selectedYear;
            });
        }

        // Filter by month
        if (selectedMonth) {
            filtered = filtered.filter(post => {
                const postMonth = (new Date(post.created_at).getMonth() + 1).toString().padStart(2, '0');
                return postMonth === selectedMonth;
            });
        }

        setFilteredPosts(filtered);
    };

    // Get unique years from posts
    const getAvailableYears = () => {
        const years = posts.map(post => new Date(post.created_at).getFullYear());
        return [...new Set(years)].sort((a, b) => b - a);
    };

    // Get months for selected year
    const getAvailableMonths = () => {
        if (!selectedYear) return [];
        
        const months = posts
            .filter(post => new Date(post.created_at).getFullYear().toString() === selectedYear)
            .map(post => new Date(post.created_at).getMonth() + 1);
        
        return [...new Set(months)].sort((a, b) => a - b);
    };

    const monthNames = [
        '', 'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
        'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
    ];

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilter('');
        setSelectedYear('');
        setSelectedMonth('');
    };

    const loadPosts = async () => {
        try {
            setLoading(true);
            const data = await AdminAPI.get('/admin/posts');
            setPosts(data);
        } catch (err) {
            setError('Chyba při načítání postů');
        } finally {
            setLoading(false);
        }
    };

    const loadAvailableFiles = async () => {
        try {
            // Load images
            const imagesData = await AdminAPI.get('/admin/files/available-for-posts?file_type=images');
            // Load documents
            const documentsData = await AdminAPI.get('/admin/files/available-for-posts?file_type=documents');
            
            setAvailableFiles({
                images: imagesData,
                documents: documentsData
            });
        } catch (err) {
            console.error('Chyba při načítání dostupných souborů:', err);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            content: '',
            published: false,
            image_file_id: '',
            image_position: 'right',
            document_file_id: ''
        });
        setEditingPost(null);
        setShowForm(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            setError('');
            setSuccess('');

            const payload = {
                title: formData.title,
                content: formData.content,
                published: formData.published,
                image_file_id: formData.image_file_id || null,
                image_position: formData.image_position,
                document_file_id: formData.document_file_id || null
            };

            if (editingPost) {
                await AdminAPI.put(`/admin/posts/${editingPost.id}`, payload);
                setSuccess('Post byl úspěšně aktualizován');
            } else {
                await AdminAPI.post('/admin/posts', payload);
                setSuccess('Post byl úspěšně vytvořen');
            }

            loadPosts();
            resetForm();
        } catch (err) {
            setError(err.response?.data?.detail || 'Chyba při ukládání postu');
        }
    };

    const handleEdit = (post) => {
        setFormData({
            title: post.title || '',
            content: post.content || '',
            published: post.published || false,
            image_file_id: post.image_file_id || '',
            image_position: post.image_position || 'right',
            document_file_id: post.document_file_id || ''
        });
        setEditingPost(post);
        setShowForm(true);
    };

    const handleDelete = async (postId) => {
        if (!confirm('Opravdu chcete smazat tento post?')) {
            return;
        }

        try {
            await AdminAPI.delete(`/admin/posts/${postId}`);
            setSuccess('Post byl úspěšně smazán');
            loadPosts();
        } catch (err) {
            setError(err.message || 'Chyba při mazání postu');
        }
    };

    const getFileName = (fileId, type) => {
        const files = type === 'image' ? availableFiles.images : availableFiles.documents;
        const file = files.find(f => f.id === parseInt(fileId));
        return file ? file.original_filename : 'Neznámý soubor';
    };

    // Format content with basic markdown-like formatting
    const formatContent = (content) => {
        if (!content) return '';
        
        // Replace **bold** with <strong>
        let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Replace *italic* with <em>
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        return formatted;
    };

    if (loading && posts.length === 0) {
        return (
            <div className="d-flex justify-content-center p-4">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Načítám...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">Správa postů</h2>
                <button 
                    className="btn btn-primary"
                    onClick={() => setShowForm(true)}
                >
                    <i className="bi bi-plus-lg me-2"></i>
                    Nový post
                </button>
            </div>

            {error && (
                <div className="alert alert-danger alert-dismissible fade show">
                    {error}
                    <button type="button" className="btn-close" onClick={() => setError('')}></button>
                </div>
            )}

            {success && (
                <div className="alert alert-success alert-dismissible fade show">
                    {success}
                    <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
                </div>
            )}

            {/* Filter Bar */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-md-4">
                            <label className="form-label">
                                🔍 Hledat v příspěvcích
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Zadejte hledaný výraz..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label">
                                ✅ Status
                            </label>
                            <select
                                className="form-select"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="">Všechny</option>
                                <option value="published">Publikované</option>
                                <option value="draft">Koncepty</option>
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label">
                                📅 Rok
                            </label>
                            <select
                                className="form-select"
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                            >
                                <option value="">Všechny roky</option>
                                {getAvailableYears().map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label">
                                📆 Měsíc
                            </label>
                            <select
                                className="form-select"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                disabled={!selectedYear}
                            >
                                <option value="">Všechny měsíce</option>
                                {getAvailableMonths().map(month => (
                                    <option key={month} value={month.toString().padStart(2, '0')}>
                                        {monthNames[month]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <button
                                type="button"
                                className="btn btn-outline-secondary w-100"
                                onClick={clearFilters}
                                disabled={!searchTerm && !statusFilter && !selectedYear && !selectedMonth}
                            >
                                ❌ Vymazat
                            </button>
                        </div>
                    </div>
                    
                    {(searchTerm || statusFilter || selectedYear || selectedMonth) && (
                        <div className="mt-3">
                            <small className="text-muted">
                                Zobrazeno {filteredPosts.length} z {posts.length} příspěvků
                            </small>
                        </div>
                    )}
                </div>
            </div>

            {showForm && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h5 className="mb-0">
                            {editingPost ? 'Upravit post' : 'Nový post'}
                        </h5>
                    </div>
                    <div className="card-body">
                        <form onSubmit={handleSubmit}>
                            <div className="row">
                                <div className="col-md-8">
                                    <div className="mb-3">
                                        <label className="form-label">Nadpis</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={formData.title}
                                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                                            required
                                        />
                                    </div>
                                    
                                    <div className="mb-3">
                                        <label className="form-label">Obsah</label>
                                        <textarea
                                            className="form-control"
                                            rows={8}
                                            value={formData.content}
                                            onChange={(e) => setFormData({...formData, content: e.target.value})}
                                            required
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
                                                Publikován
                                            </label>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label">Obrázek</label>
                                        <select
                                            className="form-select"
                                            value={formData.image_file_id}
                                            onChange={(e) => setFormData({...formData, image_file_id: e.target.value})}
                                        >
                                            <option value="">-- Bez obrázku --</option>
                                            {availableFiles.images.map(file => (
                                                <option key={file.id} value={file.id}>
                                                    {file.original_filename}
                                                    {file.usage_info.length > 0 && ' (použit)'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {formData.image_file_id && (
                                        <div className="mb-3">
                                            <label className="form-label">Pozice obrázku</label>
                                            <select
                                                className="form-select"
                                                value={formData.image_position}
                                                onChange={(e) => setFormData({...formData, image_position: e.target.value})}
                                            >
                                                <option value="left">Vlevo od textu (čtvercový thumbnail)</option>
                                                <option value="right">Vpravo od textu (čtvercový thumbnail)</option>
                                                <option value="top">Nad textem (hlavička článku)</option>
                                                <option value="none">Nezobrazovat</option>
                                            </select>
                                            <div className="form-text">
                                                Doporučeno: Vlevo/Vpravo pro QR kódy a menší obrázky. Nad textem pro větší ilustrace.
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <label className="form-label">Dokument</label>
                                        <select
                                            className="form-select"
                                            value={formData.document_file_id}
                                            onChange={(e) => setFormData({...formData, document_file_id: e.target.value})}
                                        >
                                            <option value="">-- Bez dokumentu --</option>
                                            {availableFiles.documents.map(file => (
                                                <option key={file.id} value={file.id}>
                                                    {file.original_filename}
                                                    {file.usage_info.length > 0 && ' (použit)'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="d-flex gap-2">
                                <button type="submit" className="btn btn-success">
                                    {editingPost ? 'Aktualizovat' : 'Vytvořit'}
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-secondary"
                                    onClick={resetForm}
                                >
                                    Zrušit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="card">
                <div className="card-header">
                    <h5 className="mb-0">Posty ({filteredPosts.length})</h5>
                </div>
                <div className="card-body p-0">
                    {filteredPosts.length === 0 ? (
                        <div className="text-center p-4 text-muted">
                            {posts.length === 0 ? 'Zatím nejsou žádné posty' : 'Žádné posty nevyhovují zadaným filtrům'}
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Nadpis</th>
                                        <th>Status</th>
                                        <th>Přílohy</th>
                                        <th>Vytvořen</th>
                                        <th width="150">Akce</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPosts.map(post => (
                                        <tr key={post.id}>
                                            <td>
                                                <div className="fw-medium">{post.title}</div>
                                                <div className="text-muted small">
                                                    {post.content?.substring(0, 100)}
                                                    {post.content?.length > 100 && '...'}
                                                </div>
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
                                                </div>
                                            </td>
                                            <td className="text-muted small">
                                                {new Date(post.created_at).toLocaleString('cs-CZ')}
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
        </div>
    );
}

export default PostManagement;