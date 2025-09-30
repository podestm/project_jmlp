import React, { useState, useEffect } from 'react';
import { useAuth } from '../../config/auth.jsx';
import { API_CONFIG } from '../../config/api.js';

export default function DocumentManagement() {
  const { token } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');

  useEffect(() => {
    loadFiles();
  }, [fileTypeFilter]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const filterParam = fileTypeFilter !== 'all' ? `?file_type=${fileTypeFilter}` : '';
      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/files${filterParam}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setFiles(data);
      setError(null);
    } catch (error) {
      console.error('Error loading files:', error);
      setError('Nepodařilo se načíst soubory');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result = await response.json();
      setSuccess(`Soubor "${result.original_filename}" byl úspěšně nahrán`);
      
      // Reset file input
      event.target.value = '';
      
      // Reload files
      await loadFiles();
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Chyba při nahrávání souboru');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId, filename) => {
    if (!window.confirm(`Opravdu chcete smazat soubor "${filename}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Delete failed');
      }

      setSuccess(`Soubor "${filename}" byl úspěšně smazán`);
      await loadFiles();
    } catch (error) {
      console.error('Delete error:', error);
      setError(error.message || 'Chyba při mazání souboru');
    }
  };

  const getFileTypeColor = (type) => {
    switch (type) {
      case 'propozice': return 'bg-primary';
      case 'vysledky': return 'bg-success';
      case 'image': return 'bg-info';
      case 'neprirazene': return 'bg-warning';
      default: return 'bg-secondary';
    }
  };

  const getFileTypeLabel = (type) => {
    switch (type) {
      case 'propozice': return 'Propozice';
      case 'vysledky': return 'Výsledky';
      case 'image': return 'Obrázek';
      case 'neprirazene': return 'Nepřiřazené';
      default: return type;
    }
  };

  const getFileExtension = (filename) => {
    if (!filename) return '';
    const extension = filename.split('.').pop();
    return extension ? extension.toUpperCase() : '';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('cs-CZ');
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Načítám...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>Správa souborů</h2>
            <div className="d-flex gap-3 align-items-center">
              <select 
                className="form-select" 
                style={{width: 'auto'}}
                value={fileTypeFilter}
                onChange={(e) => setFileTypeFilter(e.target.value)}
              >
                <option value="all">Všechny soubory</option>
                <option value="propozice">Propozice</option>
                <option value="vysledky">Výsledky</option>
                <option value="image">Obrázky</option>
                <option value="neprirazene">Nepřiřazené</option>
              </select>
              <label className="btn btn-primary">
                <i className="bi bi-cloud-upload me-2"></i>
                Nahrát soubor
                <input 
                  type="file" 
                  onChange={handleFileUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success" role="alert">
              <i className="bi bi-check-circle-fill me-2"></i>
              {success}
            </div>
          )}

          {uploading && (
            <div className="alert alert-info" role="alert">
              <div className="d-flex align-items-center">
                <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                Nahrávám soubor...
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Soubor</th>
                      <th>Typ</th>
                      <th>Velikost</th>
                      <th>Použití</th>
                      <th>Nahrán</th>
                      <th>Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted">
                          Žádné soubory nenalezeny
                        </td>
                      </tr>
                    ) : (
                      files.map((file) => (
                        <tr key={file.id}>
                          <td>
                            <div className="d-flex align-items-center">
                              <i className={`bi ${file.file_type === 'image' ? 'bi-image' : 'bi-file-earmark'} me-2`}></i>
                              <div>
                                <div className="fw-semibold">{file.original_filename}</div>
                                <small className="text-muted">{file.filename}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${getFileTypeColor(file.file_type)}`}>
                              {getFileExtension(file.original_filename)}
                            </span>
                          </td>
                          <td>{formatFileSize(file.file_size)}</td>
                          <td>
                            {file.usage_info && file.usage_info.length > 0 ? (
                              <div>
                                {file.usage_info.map((usage, index) => (
                                  <div key={index} className="badge bg-secondary me-1 mb-1">
                                    {usage.type}: {usage.title}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted">Nepoužito</span>
                            )}
                          </td>
                          <td>{formatDate(file.uploaded_at)}</td>
                          <td>
                            <div className="btn-group">
                              <a
                                href={`${API_CONFIG.BASE_URL}/admin/files/${file.id}/download`}
                                className="btn btn-sm btn-outline-primary"
                                title="Stáhnout"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <i className="bi bi-download"></i>
                              </a>
                              <button
                                onClick={() => handleDeleteFile(file.id, file.original_filename)}
                                className="btn btn-sm btn-outline-danger"
                                title="Smazat"
                                disabled={file.usage_info && file.usage_info.length > 0}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}