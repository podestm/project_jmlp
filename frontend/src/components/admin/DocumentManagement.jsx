import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../../config/auth.jsx';
import { AdminAPI } from '../../config/api.js';
import Alert from '../ui/Alert.jsx';

export default function DocumentManagement() {
  const { token } = useAuth();
  const [allFiles, setAllFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  // Folder state
  const [selectedFolder, setSelectedFolder] = useState(null); // null=all, ''=unassigned, 'name'=folder
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameFolderName, setRenameFolderName] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const lastClickedRef = useRef(null);

  // Folder context menu
  const [openMenu, setOpenMenu] = useState(null);

  // Drag & drop
  const [dragOverFolder, setDragOverFolder] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragImageRef = useRef(null);

  // Filters
  const [extensionFilter, setExtensionFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fileInputRef = useRef(null);
  const newFolderInputRef = useRef(null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (showNewFolderInput && newFolderInputRef.current) newFolderInputRef.current.focus();
  }, [showNewFolderInput]);

  // Close folder menu on outside click
  useEffect(() => {
    if (!openMenu) return;
    const handler = () => setOpenMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMenu]);

  // ============ DATA LOADING ============

  const loadData = async () => {
    try {
      setLoading(true);
      const [filesData, foldersData] = await Promise.all([
        AdminAPI.get('/api/admin/files'),
        AdminAPI.get('/api/admin/folders')
      ]);
      setAllFiles(filesData);
      setFolders(foldersData.folders || []);
      setError(null);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Nepodařilo se načíst data');
    } finally {
      setLoading(false);
    }
  };

  // Silent background refresh — no loading spinner, preserves selection
  const refreshData = async () => {
    try {
      const [filesData, foldersData] = await Promise.all([
        AdminAPI.get('/api/admin/files'),
        AdminAPI.get('/api/admin/folders')
      ]);
      setAllFiles(filesData);
      setFolders(foldersData.folders || []);
    } catch (err) {
      console.error('Background refresh error:', err);
    }
  };

  // ============ COMPUTED / MEMOIZED ============

  const filteredFiles = useMemo(() => {
    let filtered = allFiles;
    // Folder filter
    if (selectedFolder === '') {
      filtered = filtered.filter(f => !f.folder);
    } else if (selectedFolder !== null) {
      filtered = filtered.filter(f => f.folder === selectedFolder);
    }
    // Extension filter
    if (extensionFilter !== 'all') {
      filtered = filtered.filter(file => {
        const ext = file.original_filename?.split('.').pop()?.toLowerCase();
        return ext === extensionFilter;
      });
    }
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(file =>
        file.original_filename?.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [allFiles, selectedFolder, extensionFilter, searchTerm]);

  const availableExtensions = useMemo(() => {
    const extensions = new Set();
    allFiles.forEach(file => {
      const ext = file.original_filename?.split('.').pop()?.toLowerCase();
      if (ext) extensions.add(ext);
    });
    return Array.from(extensions).sort();
  }, [allFiles]);

  const unassignedCount = useMemo(() => allFiles.filter(f => !f.folder).length, [allFiles]);

  const folderFileCounts = useMemo(() => {
    const counts = {};
    allFiles.forEach(f => {
      if (f.folder) counts[f.folder] = (counts[f.folder] || 0) + 1;
    });
    return counts;
  }, [allFiles]);

  // Clear selection when folder/filter changes
  useEffect(() => {
    setSelectedIds(new Set());
    lastClickedRef.current = null;
  }, [selectedFolder, extensionFilter, searchTerm]);

  // ============ SELECTION ============

  // isToggle=true for checkbox clicks (always add/remove without clearing)
  const toggleSelect = useCallback((fileId, event, isToggle = false) => {
    const fileIds = filteredFiles.map(f => f.id);

    setSelectedIds(prev => {
      const next = new Set(prev);

      if (event.shiftKey && lastClickedRef.current !== null) {
        // Range select
        const lastIdx = fileIds.indexOf(lastClickedRef.current);
        const currIdx = fileIds.indexOf(fileId);
        if (lastIdx !== -1 && currIdx !== -1) {
          const [start, end] = lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx];
          for (let i = start; i <= end; i++) {
            next.add(fileIds[i]);
          }
        }
      } else if (isToggle || event.ctrlKey || event.metaKey) {
        // Toggle single (checkboxes always toggle)
        if (next.has(fileId)) next.delete(fileId);
        else next.add(fileId);
      } else {
        // Replace selection (row click without modifier)
        if (next.size === 1 && next.has(fileId)) {
          next.clear();
        } else {
          next.clear();
          next.add(fileId);
        }
      }
      return next;
    });
    lastClickedRef.current = fileId;
  }, [filteredFiles]);

  const selectAll = useCallback(() => {
    if (selectedIds.size === filteredFiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFiles.map(f => f.id)));
    }
  }, [filteredFiles, selectedIds]);

  // ============ DRAG & DROP ============

  const handleDragStart = useCallback((e, fileId) => {
    // If dragged file is not in selection, select only that file
    let dragIds;
    if (selectedIds.has(fileId)) {
      dragIds = Array.from(selectedIds);
    } else {
      dragIds = [fileId];
      setSelectedIds(new Set([fileId]));
    }

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify(dragIds));

    // Custom drag image
    if (dragImageRef.current) {
      const el = dragImageRef.current;
      el.textContent = dragIds.length === 1
        ? '1 soubor'
        : dragIds.length + ' souborů';
      el.style.display = 'block';
      e.dataTransfer.setDragImage(el, 0, 0);
      requestAnimationFrame(() => { el.style.display = 'none'; });
    }
    setIsDragging(true);
  }, [selectedIds]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDragOverFolder(null);
  }, []);

  const handleFolderDragOver = useCallback((e, folderKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderKey);
  }, []);

  const handleFolderDragLeave = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX: x, clientY: y } = e;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverFolder(null);
    }
  }, []);

  const handleFolderDrop = useCallback(async (e, targetFolder) => {
    e.preventDefault();
    setDragOverFolder(null);
    setIsDragging(false);

    let fileIds;
    try {
      fileIds = JSON.parse(e.dataTransfer.getData('application/json'));
    } catch { return; }
    if (!fileIds || !fileIds.length) return;

    const folderValue = targetFolder === '__unassigned__' ? null : targetFolder;

    // Optimistic update
    setAllFiles(prev => prev.map(f =>
      fileIds.includes(f.id) ? { ...f, folder: folderValue } : f
    ));

    // Update folder counts optimistically
    setFolders(prev => {
      // We'll just refresh from the server for accurate counts
      return prev;
    });

    setSuccess(fileIds.length === 1
      ? 'Soubor přesunut'
      : fileIds.length + ' souborů přesunuto');
    setSelectedIds(new Set());

    try {
      if (fileIds.length === 1) {
        const formData = new FormData();
        if (folderValue) formData.append('folder', folderValue);
        await AdminAPI.upload('/api/admin/files/' + fileIds[0] + '/move', formData);
      } else {
        const formData = new FormData();
        formData.append('file_ids', fileIds.join(','));
        if (folderValue) formData.append('folder', folderValue);
        await AdminAPI.upload('/api/admin/files/batch-move', formData);
      }
      // Silent refresh for accurate counts
      refreshData();
    } catch (err) {
      setError(err.message || 'Chyba při přesunu souborů');
      // Revert on error
      await refreshData();
    }
  }, []);

  // ============ FOLDER OPERATIONS ============

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;

    // Optimistic
    const tempId = Date.now();
    setFolders(prev => [...prev, { id: tempId, name, file_count: 0 }]);
    setNewFolderName('');
    setShowNewFolderInput(false);
    setSuccess('Složka "' + name + '" vytvořena');

    try {
      const formData = new FormData();
      formData.append('name', name);
      await AdminAPI.upload('/api/admin/folders', formData);
      refreshData();
    } catch (err) {
      setError(err.message || 'Chyba při vytváření složky');
      refreshData(); // revert
    }
  };

  const handleRenameFolder = async (oldName) => {
    const newName = renameFolderName.trim();
    if (!newName || newName === oldName) { setRenamingFolder(null); return; }

    // Optimistic
    setFolders(prev => prev.map(f => f.name === oldName ? { ...f, name: newName } : f));
    setAllFiles(prev => prev.map(f => f.folder === oldName ? { ...f, folder: newName } : f));
    if (selectedFolder === oldName) setSelectedFolder(newName);
    setRenamingFolder(null);
    setSuccess('Složka přejmenována na "' + newName + '"');

    try {
      const formData = new FormData();
      formData.append('name', oldName);
      formData.append('new_name', newName);
      await AdminAPI.upload('/api/admin/folders/rename', formData);
      refreshData();
    } catch (err) {
      setError(err.message || 'Chyba při přejmenování složky');
      refreshData();
    }
  };

  const handleDeleteFolder = async (folderName) => {
    const fileCount = folderFileCounts[folderName] || 0;
    let deleteFiles = false;

    if (fileCount > 0) {
      const choice = window.prompt(
        'Složka "' + folderName + '" obsahuje ' + fileCount + ' souborů.\n\n'
        + 'Zadejte:\n'
        + '  1 = Smazat složku, soubory ponechat jako nepřiřazené\n'
        + '  2 = Smazat složku i se soubory\n'
        + '  (nebo zrušte pro návrat)',
        '1'
      );
      if (!choice) return;
      deleteFiles = choice.trim() === '2';
    } else {
      if (!window.confirm('Smazat prázdnou složku "' + folderName + '"?')) return;
    }

    // Optimistic
    setFolders(prev => prev.filter(f => f.name !== folderName));
    if (deleteFiles) {
      setAllFiles(prev => prev.filter(f => f.folder !== folderName));
    } else {
      setAllFiles(prev => prev.map(f => f.folder === folderName ? { ...f, folder: null } : f));
    }
    if (selectedFolder === folderName) setSelectedFolder(null);
    setSuccess(deleteFiles
      ? 'Složka "' + folderName + '" a její soubory smazány'
      : 'Složka "' + folderName + '" odstraněna'
    );

    try {
      await AdminAPI.delete('/api/admin/folders?name=' + encodeURIComponent(folderName) + (deleteFiles ? '&delete_files=true' : ''));
      refreshData();
    } catch (err) {
      setError(err.message || 'Chyba při mazání složky');
      refreshData();
    }
  };

  // ============ FILE OPERATIONS ============

  const handleFileUpload = async (event) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of uploadedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        if (selectedFolder && selectedFolder !== '') {
          formData.append('folder', selectedFolder);
        }
        await AdminAPI.upload('/api/admin/files/upload', formData);
      }
      const count = uploadedFiles.length;
      setSuccess(count === 1
        ? 'Soubor úspěšně nahrán' + (selectedFolder ? ' do složky "' + selectedFolder + '"' : '')
        : count + ' souborů nahráno' + (selectedFolder ? ' do složky "' + selectedFolder + '"' : '')
      );
      event.target.value = '';
      await refreshData();
    } catch (err) {
      setError(err.message || 'Chyba při nahrávání souboru');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId, filename) => {
    if (!window.confirm('Opravdu chcete smazat soubor "' + filename + '"?')) return;

    // Optimistic
    setAllFiles(prev => prev.filter(f => f.id !== fileId));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(fileId); return n; });
    setSuccess('Soubor "' + filename + '" smazán');

    try {
      await AdminAPI.delete('/api/admin/files/' + fileId);
      refreshData();
    } catch (err) {
      setError(err.message || 'Chyba při mazání souboru');
      refreshData();
    }
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const msg = ids.length === 1
      ? 'Opravdu chcete smazat vybraný soubor?'
      : 'Opravdu chcete smazat ' + ids.length + ' vybraných souborů?';
    if (!window.confirm(msg)) return;

    // Optimistic
    setAllFiles(prev => prev.filter(f => !selectedIds.has(f.id)));
    setSelectedIds(new Set());
    setSuccess(ids.length === 1 ? 'Soubor smazán' : ids.length + ' souborů smazáno');

    try {
      await Promise.all(ids.map(id => AdminAPI.delete('/api/admin/files/' + id)));
      refreshData();
    } catch (err) {
      setError(err.message || 'Chyba při mazání souborů');
      refreshData();
    }
  };

  const handleDownloadFile = async (fileId, filename) => {
    try {
      const tk = localStorage.getItem('admin_token');
      const base = import.meta.env.VITE_API_BASE || '';
      const response = await fetch(base + '/api/admin/files/' + fileId + '/download', {
        headers: { 'Authorization': 'Bearer ' + tk }
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message || 'Chyba při stahování souboru');
    }
  };

  // ============ HELPERS ============

  const getFileExtension = (filename) => {
    if (!filename) return '';
    return filename.split('.').pop()?.toUpperCase() || '';
  };

  const getExtColor = (filename) => {
    if (!filename) return 'bg-secondary';
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'xlsx': case 'xls': case 'xlsm': return 'bg-success';
      case 'pdf': return 'bg-danger';
      case 'doc': case 'docx': case 'docm': return 'bg-primary';
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': return 'bg-info';
      default: return 'bg-secondary';
    }
  };

  const formatSize = (bytes) => {
    if (bytes == null) return '?';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('cs-CZ', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  // ============ RENDER ============

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Načítám...</span>
        </div>
      </div>
    );
  }

  const allSelected = filteredFiles.length > 0 && selectedIds.size === filteredFiles.length;
  const someSelected = selectedIds.size > 0;
  const selectedInView = filteredFiles.filter(f => selectedIds.has(f.id)).length;

  return (
    <div className="container-fluid admin-section">
      {/* Hidden drag image element */}
      <div
        ref={dragImageRef}
        style={{
          position: 'fixed', top: -100, left: -100,
          background: '#0d6efd', color: 'white', padding: '6px 14px',
          borderRadius: '6px', fontSize: '13px', fontWeight: 600,
          whiteSpace: 'nowrap', zIndex: 9999, display: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,.25)'
        }}
      />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0"><i className="bi bi-folder2-open me-2"></i>Správa souborů</h2>
        <div className="d-flex gap-2">
          {someSelected && (
            <>
              <button className="btn btn-outline-danger btn-sm" onClick={handleDeleteSelected}>
                <i className="bi bi-trash me-1"></i>Smazat ({selectedInView})
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedIds(new Set())}>
                Zrušit výběr
              </button>
            </>
          )}
          <label className="btn btn-primary btn-sm mb-0">
            <i className="bi bi-cloud-upload me-1"></i>
            Nahrát{selectedFolder && selectedFolder !== '' ? ' do "' + selectedFolder + '"' : ''}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              disabled={uploading}
              multiple
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {error && (
        <Alert type="danger" message={<><i className="bi bi-exclamation-triangle-fill me-2"></i>{error}</>} onDismiss={() => setError(null)} />
      )}
      {success && (
        <Alert type="success" message={<><i className="bi bi-check-circle-fill me-2"></i>{success}</>} onDismiss={() => setSuccess('')} autoDismissDelay={3000} />
      )}
      {uploading && (
        <Alert type="info" message={<div className="d-flex align-items-center"><div className="spinner-border spinner-border-sm me-2"></div>Nahrávám...</div>} autoDismissDelay={0} />
      )}

      <div className="row g-3">
        {/* ===== FOLDER SIDEBAR ===== */}
        <div className="col-md-3">
          <div className="card" style={{ position: 'sticky', top: '1rem' }}>
            <div className="card-header d-flex justify-content-between align-items-center py-2">
              <strong className="small"><i className="bi bi-folder me-1"></i>Složky</strong>
              <button
                className="btn btn-sm btn-outline-success py-0 px-1"
                onClick={() => setShowNewFolderInput(true)}
                title="Nová složka"
              >
                <i className="bi bi-plus-lg"></i>
              </button>
            </div>
            <div className="list-group list-group-flush">

              {/* All files */}
              <button
                className={'list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2'
                  + (selectedFolder === null ? ' active' : '')}
                onClick={() => setSelectedFolder(null)}
              >
                <span className="small"><i className="bi bi-collection me-2"></i>Všechny soubory</span>
                <span className="badge bg-secondary rounded-pill" style={{fontSize:'0.7rem'}}>{allFiles.length}</span>
              </button>

              {/* Unassigned - drop target */}
              <button
                className={'list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2'
                  + (selectedFolder === '' ? ' active' : '')
                  + (dragOverFolder === '__unassigned__' ? ' border-primary bg-primary bg-opacity-10' : '')}
                onClick={() => setSelectedFolder('')}
                onDragOver={(e) => handleFolderDragOver(e, '__unassigned__')}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => handleFolderDrop(e, '__unassigned__')}
              >
                <span className="small"><i className="bi bi-inbox me-2"></i>Nepřiřazené</span>
                <span className="badge bg-warning text-dark rounded-pill" style={{fontSize:'0.7rem'}}>{unassignedCount}</span>
              </button>

              {/* Folders */}
              {folders.map(folder => (
                <div
                  key={folder.id || folder.name}
                  className={'list-group-item py-2'
                    + (selectedFolder === folder.name ? ' active' : '')
                    + (dragOverFolder === folder.name ? ' border-primary bg-primary bg-opacity-10' : '')}
                  onDragOver={(e) => handleFolderDragOver(e, folder.name)}
                  onDragLeave={handleFolderDragLeave}
                  onDrop={(e) => handleFolderDrop(e, folder.name)}
                >
                  {renamingFolder === folder.name ? (
                    <div className="d-flex gap-1">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={renameFolderName}
                        onChange={(e) => setRenameFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameFolder(folder.name);
                          if (e.key === 'Escape') setRenamingFolder(null);
                        }}
                        autoFocus
                      />
                      <button className="btn btn-sm btn-success py-0" onClick={() => handleRenameFolder(folder.name)}><i className="bi bi-check"></i></button>
                      <button className="btn btn-sm btn-secondary py-0" onClick={() => setRenamingFolder(null)}><i className="bi bi-x"></i></button>
                    </div>
                  ) : (
                    <div className="d-flex justify-content-between align-items-center">
                      <span
                        className="flex-grow-1 small"
                        onClick={() => setSelectedFolder(folder.name)}
                        style={{ cursor: 'pointer' }}
                      >
                        <i className="bi bi-folder-fill me-2 text-warning"></i>
                        {folder.name}
                      </span>
                      <div className="d-flex align-items-center gap-1">
                        <span className={'badge rounded-pill' + (selectedFolder === folder.name ? ' bg-white text-primary' : ' bg-secondary')} style={{fontSize:'0.7rem'}}>
                          {folderFileCounts[folder.name] || 0}
                        </span>
                        <div className="dropdown" style={{position:'relative'}}>
                          <button
                            className={'btn btn-sm border-0 py-0 px-1' + (selectedFolder === folder.name ? ' text-white' : ' text-secondary')}
                            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === folder.name ? null : folder.name); }}
                          >
                            <i className="bi bi-three-dots-vertical" style={{fontSize:'0.75rem'}}></i>
                          </button>
                          {openMenu === folder.name && (
                            <div className="dropdown-menu show dropdown-menu-end" style={{position:'absolute', right:0, top:'100%', zIndex:1050}}>
                              <button className="dropdown-item small" onClick={() => { setOpenMenu(null); setRenamingFolder(folder.name); setRenameFolderName(folder.name); }}>
                                <i className="bi bi-pencil me-2"></i>Přejmenovat
                              </button>
                              <hr className="dropdown-divider" />
                              <button className="dropdown-item text-danger small" onClick={() => { setOpenMenu(null); handleDeleteFolder(folder.name); }}>
                                <i className="bi bi-trash me-2"></i>Smazat
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* New folder input */}
              {showNewFolderInput && (
                <div className="list-group-item py-2">
                  <div className="d-flex gap-1">
                    <input
                      ref={newFolderInputRef}
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Název složky..."
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateFolder();
                        if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); }
                      }}
                    />
                    <button className="btn btn-sm btn-success py-0" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                      <i className="bi bi-check"></i>
                    </button>
                    <button className="btn btn-sm btn-secondary py-0" onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }}>
                      <i className="bi bi-x"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Drag hint */}
            <div className="card-footer py-2">
              <small className="text-muted" style={{fontSize:'0.75rem'}}>
                {isDragging
                  ? <><i className="bi bi-arrow-right-circle me-1 text-primary"></i>Pusťte na složku pro přesun</>
                  : <><i className="bi bi-hand-index me-1"></i>Vyberte soubory a přetáhněte na složku</>
                }
              </small>
            </div>
          </div>
        </div>

        {/* ===== FILE LIST ===== */}
        <div className="col-md-9">
          {/* Filters */}
          <div className="card mb-2">
            <div className="card-body py-2">
              <div className="row g-2 align-items-center">
                <div className="col-md-5">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text"><i className="bi bi-search"></i></span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Hledat v názvech..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button className="btn btn-outline-secondary" onClick={() => setSearchTerm('')}>
                        <i className="bi bi-x"></i>
                      </button>
                    )}
                  </div>
                </div>
                <div className="col-md-3">
                  <select
                    className="form-select form-select-sm"
                    value={extensionFilter}
                    onChange={(e) => setExtensionFilter(e.target.value)}
                  >
                    <option value="all">Všechny přípony</option>
                    {availableExtensions.map(ext => (
                      <option key={ext} value={ext}>.{ext.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4 text-end">
                  <small className="text-muted">
                    <strong>{filteredFiles.length}</strong> z <strong>{allFiles.length}</strong> souborů
                    {selectedFolder !== null && selectedFolder !== '' && (
                      <span> — <i className="bi bi-folder-fill text-warning me-1" style={{fontSize: '0.7rem'}}></i><strong>{selectedFolder}</strong></span>
                    )}
                    {selectedFolder === '' && <span> — <strong>Nepřiřazené</strong></span>}
                  </small>
                </div>
              </div>
            </div>
          </div>

          {/* Selection toolbar */}
          {someSelected && (
            <div className="d-flex align-items-center gap-2 mb-2 px-1">
              <small className="text-primary fw-semibold">
                <i className="bi bi-check2-square me-1"></i>
                Vybráno {selectedInView} souborů
              </small>
              <span className="text-muted">—</span>
              <small className="text-muted">přetáhněte na složku vlevo pro přesun</small>
            </div>
          )}

          {/* File table */}
          <div className="card">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle" style={{fontSize:'0.875rem'}}>
                  <thead className="table-light">
                    <tr>
                      <th style={{width:'36px'}} className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={allSelected}
                          ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                          onChange={selectAll}
                          title="Vybrat vše"
                        />
                      </th>
                      <th>Soubor</th>
                      <th style={{width:'110px'}}>Typ / Velikost</th>
                      <th style={{width:'80px'}}>Nahrán</th>
                      <th style={{width:'70px'}}>Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center text-muted py-4">
                          <i className="bi bi-folder2-open d-block fs-1 mb-2"></i>
                          {selectedFolder !== null ? 'Složka je prázdná' : 'Žádné soubory'}
                        </td>
                      </tr>
                    ) : (
                      filteredFiles.map((file) => {
                        const isSelected = selectedIds.has(file.id);
                        return (
                          <tr
                            key={file.id}
                            draggable="true"
                            onDragStart={(e) => handleDragStart(e, file.id)}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => {
                              // Don't toggle when clicking buttons/inputs
                              if (e.target.closest('button, a, input')) return;
                              toggleSelect(file.id, e);
                            }}
                            style={{
                              cursor: 'pointer',
                              userSelect: 'none',
                              opacity: isDragging && isSelected ? 0.5 : 1,
                              background: isSelected ? 'var(--bs-primary-bg-subtle, #cfe2ff)' : undefined
                            }}
                          >
                            <td className="text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={isSelected}
                                onChange={(e) => toggleSelect(file.id, e, true)}
                              />
                            </td>
                            <td>
                              <div className="d-flex align-items-center">
                                <i className="bi bi-grip-vertical me-2 text-muted" style={{cursor:'grab', fontSize:'0.8rem'}}></i>
                                <span className="text-truncate" style={{ maxWidth: '280px' }} title={file.original_filename}>
                                  {file.original_filename}
                                </span>
                                {file.usage_info && file.usage_info.length > 0 && (
                                  <span className="badge bg-info bg-opacity-10 text-info ms-2" style={{fontSize:'0.65rem'}} title={file.usage_info.map(u => u.type + ': ' + u.title).join(', ')}>
                                    <i className="bi bi-link-45deg"></i> {file.usage_info.length}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="text-nowrap">
                              <span className={'badge ' + getExtColor(file.original_filename)} style={{fontSize:'0.65rem', padding:'2px 5px'}}>
                                {getFileExtension(file.original_filename)}
                              </span>
                              <span className="text-muted ms-1" style={{fontSize:'0.8rem'}}>{formatSize(file.file_size)}</span>
                            </td>
                            <td className="text-nowrap">
                              <small className="text-muted">{formatDate(file.uploaded_at)}</small>
                            </td>
                            <td>
                              <div className="btn-group btn-group-sm">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownloadFile(file.id, file.original_filename); }}
                                  className="btn btn-outline-primary py-0"
                                  title="Stáhnout"
                                >
                                  <i className="bi bi-download"></i>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id, file.original_filename); }}
                                  className="btn btn-outline-danger py-0"
                                  title="Smazat"
                                  disabled={file.usage_info && file.usage_info.length > 0}
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
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
