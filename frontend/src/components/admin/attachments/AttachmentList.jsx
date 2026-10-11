import { useCallback, useRef, useState } from 'react';
import { ButtonSpinner } from '../../ui/LoadingState.jsx';
import { formatFileSize } from '../../../utils/files.js';
import FileBadge from '../shared/FileBadge/FileBadge.jsx';
import LibraryPicker from './LibraryPicker.jsx';
import Icon from '../../ms/Icon/Icon.jsx';

/**
 * Seznam dokumentů jedné role, kterých smí být víc.
 *
 * Používá se tam, kde vlastník není omezený na jeden soubor - typicky obecné
 * dokumenty sezóny (soutěžní řád, pokyny pro organizátory). Pro role s
 * omezením na jeden soubor je AttachmentSlot.
 */
export default function AttachmentList({
  label,
  hint,
  accept,
  attachments,
  uploading = false,
  disabled = false,
  onUpload,
  onPickFromLibrary,
  onRename,
  onTogglePublished,
  onRemove
}) {
  const [dragOver, setDragOver] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const inputRef = useRef(null);

  const busy = uploading || disabled;

  const handleFiles = useCallback((fileList) => {
    Array.from(fileList || []).forEach((file) => onUpload(file));
  }, [onUpload]);

  // Příloha už vlastní název nemá - edituje se rovnou název souboru.
  const startRename = (attachment) => {
    setEditingId(attachment.id);
    setDraftName(attachment.original_filename || '');
  };

  const commitRename = (attachment) => {
    const name = draftName.trim();
    setEditingId(null);
    if (name && name !== attachment.original_filename) {
      onRename(attachment, name);
    }
  };

  return (
    <div className="mb-3">
      <label className="form-label">{label}</label>

      {attachments.length > 0 && (
        <ul className="list-group mb-2">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="list-group-item d-flex align-items-center gap-2">
              <FileBadge filename={attachment.original_filename} />

              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                {editingId === attachment.id ? (
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={draftName}
                    autoFocus
                    aria-label="Nový název souboru"
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => commitRename(attachment)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(attachment);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <>
                    <a
                      href={attachment.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="d-block text-truncate text-decoration-none"
                      title={attachment.original_filename}
                    >
                      {attachment.original_filename}
                    </a>
                    <small className="text-muted">{formatFileSize(attachment.file_size)}</small>
                  </>
                )}
              </div>

              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  checked={attachment.published}
                  onChange={(e) => onTogglePublished(attachment, e.target.checked)}
                  disabled={busy}
                  title={attachment.published ? 'Zveřejněno' : 'Skryto'}
                />
              </div>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => startRename(attachment)}
                disabled={busy}
                aria-label="Přejmenovat" title="Přejmenovat"
              >
                <Icon name="pencil" />
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => onRemove(attachment)}
                disabled={busy}
                aria-label="Odpojit" title="Odpojit"
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        className={`attachment-dropzone border rounded p-3 text-center ${dragOver ? 'border-primary bg-primary-subtle' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!busy) handleFiles(e.dataTransfer.files);
        }}
        style={{ borderStyle: 'dashed', cursor: busy ? 'default' : 'pointer' }}
        onClick={() => !busy && inputRef.current?.click()}
      >
        {uploading ? (
          <span className="text-muted"><ButtonSpinner /> Nahrávám…</span>
        ) : (
          <>
            <Icon name="cloud-upload" className="fs-5 d-block text-muted" style={{ marginInline: 'auto' }} />
            <span className="small text-muted">Přetáhněte soubory sem nebo klikněte</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          style={{ display: 'none' }}
          disabled={busy}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

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
          onSelect={(file) => { setPickerOpen(false); onPickFromLibrary(file); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
