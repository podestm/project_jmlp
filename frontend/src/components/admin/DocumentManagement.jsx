import React, { useState, useEffect } from 'react';
import { useAuth } from '../../config/auth.jsx';
import { API_CONFIG } from '../../config/api.js';

export default function DocumentManagement() {
  const { token } = useAuth();
  const [files, setFiles] = useState([]);
  const [allFiles, setAllFiles] = useState([]); // Všechny soubory bez filtrování
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  
  // Nové filtry
  const [extensionFilter, setExtensionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFiles();
  }, [fileTypeFilter]);

  // Filtrování souborů na frontendu
  useEffect(() => {
    applyFilters();
  }, [allFiles, extensionFilter, dateFilter, searchTerm]);

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
      setAllFiles(data);
      setError(null);
    } catch (error) {
      console.error('Error loading files:', error);
      setError('Nepodařilo se načíst soubory');
    } finally {
      setLoading(false);
    }
  };

  // Aplikovat filtry na frontendu
  const applyFilters = () => {
    let filtered = [...allFiles];

    // Filtr podle přípony
    if (extensionFilter !== 'all') {
      filtered = filtered.filter(file => {
        const ext = file.original_filename?.split('.').pop()?.toLowerCase();
        return ext === extensionFilter;
      });
    }

    // Filtr podle data nahrání
    if (dateFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(file => {
        const uploadDate = new Date(file.created_at);
        const daysDiff = Math.floor((now - uploadDate) / (1000 * 60 * 60 * 24));
        
        switch (dateFilter) {
          case 'today':
            return daysDiff === 0;
          case 'week':
            return daysDiff <= 7;
          case 'month':
            return daysDiff <= 30;
          case 'year':
            return daysDiff <= 365;
          default:
            return true;
        }
      });
    }

    // Filtr podle názvu souboru
    if (searchTerm) {
      filtered = filtered.filter(file =>
        file.original_filename?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFiles(filtered);
  };

  // Získat všechny unikátní přípony
  const getAvailableExtensions = () => {
    const extensions = new Set();
    allFiles.forEach(file => {
      const ext = file.original_filename?.split('.').pop()?.toLowerCase();
      if (ext) extensions.add(ext);
    });
    return Array.from(extensions).sort();
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

  const handleDownloadFile = async (fileId, filename) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/files/${fileId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Download failed');
      }

      // Create blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Download error:', error);
      setError(error.message || 'Chyba při stahování souboru');
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

  // Barva badge podle přípony souboru
  const getFileExtensionColor = (filename) => {
    if (!filename) return 'bg-secondary';
    const extension = filename.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      // Excel soubory - zelená
      case 'xlsx':
      case 'xls':
      case 'xlsm':
        return 'bg-success';
      
      // PDF - červená
      case 'pdf':
        return 'bg-danger';
      
      // Word dokumenty - modrá
      case 'doc':
      case 'docx':
      case 'docm':
        return 'bg-primary';
      
      // Obrázky - tyrkysová
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return 'bg-info';
      
      // Text soubory - šedá
      case 'txt':
      case 'csv':
        return 'bg-secondary';
      
      // PowerPoint - oranžová
      case 'ppt':
      case 'pptx':
      case 'pptm':
        return 'bg-warning';
      
      // Komprimované - tmavě modrá
      case 'zip':
      case 'rar':
      case '7z':
        return 'bg-dark';
      
      // Ostatní - šedá
      default:
        return 'bg-secondary';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === undefined || bytes === null) return 'Neznámá velikost';
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

          {/* Filtry */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label">Typ dokumentu</label>
                  <select 
                    className="form-select"
                    value={fileTypeFilter}
                    onChange={(e) => setFileTypeFilter(e.target.value)}
                  >
                    <option value="all">Všechny typy</option>
                    <option value="propozice">Propozice</option>
                    <option value="vysledky">Výsledky</option>
                    <option value="image">Obrázky</option>
                    <option value="neprirazene">Nepřiřazené</option>
                  </select>
                </div>

                <div className="col-md-2">
                  <label className="form-label">Přípona souboru</label>
                  <select 
                    className="form-select"
                    value={extensionFilter}
                    onChange={(e) => setExtensionFilter(e.target.value)}
                  >
                    <option value="all">Všechny přípony</option>
                    {getAvailableExtensions().map(ext => (
                      <option key={ext} value={ext}>.{ext.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-2">
                  <label className="form-label">Datum nahrání</label>
                  <select 
                    className="form-select"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  >
                    <option value="all">Celá historie</option>
                    <option value="today">Dnes</option>
                    <option value="week">Poslední týden</option>
                    <option value="month">Poslední měsíc</option>
                    <option value="year">Poslední rok</option>
                  </select>
                </div>

                <div className="col-md-3">
                  <label className="form-label">Hledat v názvech</label>
                  <input 
                    type="text"
                    className="form-control"
                    placeholder="Zadejte název souboru..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="col-md-2 d-flex align-items-end">
                  <button 
                    className="btn btn-outline-secondary w-100"
                    onClick={() => {
                      setExtensionFilter('all');
                      setDateFilter('all');
                      setSearchTerm('');
                    }}
                  >
                    <i className="bi bi-x-circle me-1"></i>
                    Vymazat filtry
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <small className="text-muted">
                  Zobrazeno: <strong>{files.length}</strong> z <strong>{allFiles.length}</strong> souborů
                </small>
              </div>
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
                            <span className={`badge ${getFileExtensionColor(file.original_filename)}`}>
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
                              <button
                                onClick={() => handleDownloadFile(file.id, file.original_filename)}
                                className="btn btn-sm btn-outline-primary"
                                title="Stáhnout"
                              >
                                <i className="bi bi-download"></i>
                              </button>
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