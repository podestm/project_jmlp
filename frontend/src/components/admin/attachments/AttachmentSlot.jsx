import { useCallback, useRef, useState } from 'react';
import { ButtonSpinner } from '../../ui/LoadingState.jsx';
import { getExtensionBadgeClass, getExtensionLabel, formatFileSize } from '../../../utils/files.js';
import LibraryPicker from './LibraryPicker.jsx';
import { ROLE_LABELS } from '../../../config/attachmentsApi.js';

/**
 * Jeden dokument dané role - obsazený, nebo prázdná drop zóna.
 *
 * Používá se tam, kde vlastník smí mít od role nejvýše jeden soubor:
 * závod (propozice, výsledky), příspěvek (obrázek, dokument), klub (logo).
 */
export default function AttachmentSlot({
  label,
  hint,
  accept,
  attachment,
  roleOptions = null,
  activeRole,
  uploading = false,
  disabled = false,
  onUpload,
  onPickFromLibrary,
  onRoleChange,
  onTogglePublished,
  onRemove
}) {
  const [dragOver, setDragOver] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Typ, se kterým se nahraje nový soubor (jen u slotu s výběrem typu).
  const [pendingRole, setPendingRole] = useState(activeRole);
  const inputRef = useRef(null);

  const uploadRole = attachment ? attachment.role : pendingRole;

  const handleFiles = useCallback((fileList) => {
    const file = fileList?.[0];
    if (file) onUpload(file, uploadRole);
  }, [onUpload, uploadRole]);

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    setDragOver(false);
    if (!disabled && !uploading) handleFiles(event.dataTransfer.files);
  }, [disabled, uploading, handleFiles]);

  const busy = uploading || disabled;

  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <label className="form-label mb-0">{label}</label>
        {attachment && (
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id={`published-${attachment.id}`}
              checked={attachment.published}
              onChange={(e) => onTogglePublished(e.target.checked)}
              disabled={busy}
            />
            <label className="form-check-label small" htmlFor={`published-${attachment.id}`}>
              {attachment.published ? 'Zveřejněno' : 'Skryto'}
            </label>
          </div>
        )}
      </div>

      {roleOptions && (
        <select
          className="form-select form-select-sm mb-2"
          value={uploadRole}
          onChange={(e) => {
            const role = e.target.value;
            setPendingRole(role);
            if (attachment) onRoleChange(role);
          }}
          disabled={busy}
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
          ))}
        </select>
      )}

      {attachment ? (
        <div className="border rounded p-2 d-flex align-items-center gap-2 bg-light">
          <span className={`badge ${getExtensionBadgeClass(attachment.original_filename)}`}>
            {getExtensionLabel(attachment.original_filename)}
          </span>
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <a
              href={attachment.download_url}
              target="_blank"
              rel="noopener noreferrer"
              className="d-block text-truncate text-decoration-none"
              title={attachment.original_filename}
            >
              {attachment.original_filename}
            </a>
            <small className="text-muted">
              {formatFileSize(attachment.file_size)}
              {attachment.is_generated && (
                <span className="badge bg-info-subtle text-info-emphasis ms-2">vygenerováno</span>
              )}
            </small>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={onRemove}
            disabled={busy}
            title="Odpojit dokument"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
      ) : (
        <div
          className={`border rounded p-3 text-center ${dragOver ? 'border-primary bg-primary-subtle' : 'border-dashed'}`}
          onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{ borderStyle: 'dashed', cursor: busy ? 'default' : 'pointer' }}
          onClick={() => !busy && inputRef.current?.click()}
        >
          {uploading ? (
            <span className="text-muted"><ButtonSpinner /> Nahrávám…</span>
          ) : (
            <>
              <i className="bi bi-cloud-arrow-up fs-4 d-block text-muted" />
              <span className="small text-muted">Přetáhněte soubor sem nebo klikněte</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            disabled={busy}
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mt-1">
        <small className="form-text mb-0">{hint}</small>
        <button
          type="button"
          className="btn btn-link btn-sm p-0"
          onClick={() => setPickerOpen(true)}
          disabled={busy}
        >
          Vybrat z knihovny
        </button>
      </div>

      {pickerOpen && (
        <LibraryPicker
          accept={accept}
          onSelect={(file) => { setPickerOpen(false); onPickFromLibrary(file, uploadRole); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
