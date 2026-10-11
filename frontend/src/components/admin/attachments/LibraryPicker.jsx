import { useEffect, useMemo, useState } from 'react';
import LoadingState from '../../ui/LoadingState.jsx';
import EmptyState from '../../ui/EmptyState.jsx';
import { Alert, Button, Field, Input, Modal } from '../../ms/index.js';
import { AttachmentsAPI } from '../../../config/attachmentsApi.js';
import { getExtension, getExtensionBadgeClass, getExtensionLabel, formatFileSize } from '../../../utils/files.js';
import { formatDateShort } from '../../../utils/date.js';

/**
 * Výběr už nahraného souboru z knihovny.
 *
 * Nahrazuje tři různé implementace téhož vyhledávání (dvě v useRaceManagement,
 * jednu v SeasonResultsManagement) a dva holé <select> v PostForm.
 *
 * Obal je kit Modal (Escape, klik do překryvu, zámek scrollu, návrat fokusu);
 * seznam souborů se převede s obrazovkou Přílohy (Fáze 4).
 */
export default function LibraryPicker({ accept, onSelect, onClose }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    AttachmentsAPI.library()
      .then((data) => { if (active) setFiles(data); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // `accept` je seznam přípon jako u <input accept>, např. ".pdf,.doc"
  const allowedExtensions = useMemo(() => {
    if (!accept) return null;
    return new Set(accept.split(',').map((ext) => ext.trim().replace(/^\./, '').toLowerCase()));
  }, [accept]);

  const visibleFiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return files.filter((file) => {
      if (allowedExtensions && !allowedExtensions.has(getExtension(file.original_filename))) return false;
      if (!needle) return true;
      return (file.original_filename || '').toLowerCase().includes(needle);
    });
  }, [files, query, allowedExtensions]);

  return (
    <Modal
      open
      size="lg"
      title="Vybrat z knihovny"
      onClose={() => onClose()}
      footer={<Button data-cancel onClick={onClose}>Zavřít</Button>}
    >
      <Field label="Hledat podle názvu">
        <Input
          type="search"
          size="sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-autofocus
        />
      </Field>

      {error && <Alert type="danger" compact>{error}</Alert>}
      {loading && <LoadingState variant="inline" label="Načítám knihovnu…" />}

      {!loading && !error && visibleFiles.length === 0 && (
        <EmptyState
          icon="folder"
          title="Žádný odpovídající soubor"
          hint="Zkuste jiný výraz, nebo soubor rovnou nahrajte přetažením."
        />
      )}

      {!loading && visibleFiles.length > 0 && (
        <div className="list-group">
          {visibleFiles.map((file) => (
            <button
              key={file.id}
              type="button"
              className="list-group-item list-group-item-action d-flex align-items-center gap-2"
              onClick={() => onSelect(file)}
            >
              <span className={`badge ${getExtensionBadgeClass(file.original_filename)}`}>
                {getExtensionLabel(file.original_filename)}
              </span>
              <span className="flex-grow-1 text-truncate text-start">
                {file.original_filename}
              </span>
              <small className="text-muted text-nowrap">
                {formatFileSize(file.file_size)} · {formatDateShort(file.uploaded_at)}
              </small>
              {file.usage_info?.length > 0 && (
                <span className="badge bg-secondary" title={file.usage_info.map((u) => `${u.type}: ${u.title}`).join('\n')}>
                  použit {file.usage_info.length}×
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
