import { useState } from 'react';
import { IconButton, Switch } from '../../../ms/index.js';
import FileInfo from '../../shared/FileInfo/FileInfo.jsx';
import RenameInput from '../../shared/RenameInput/RenameInput.jsx';
import DropZone from '../DropZone/DropZone.jsx';
import LibraryPicker from '../LibraryPicker/LibraryPicker.jsx';
import SlotCard from '../SlotCard/SlotCard.jsx';
import styles from './AttachmentList.module.css';

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
  onRemove,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');

  const busy = uploading || disabled;

  const handleFiles = (fileList) => {
    Array.from(fileList || []).forEach((file) => onUpload(file));
  };

  // Příloha už vlastní název nemá - edituje se rovnou název souboru.
  const startRename = (attachment) => {
    setEditingId(attachment.id);
    setDraftName(attachment.original_filename || '');
  };

  const commitRename = (attachment) => {
    const name = draftName.trim();
    setEditingId(null);
    if (name && name !== attachment.original_filename) onRename(attachment, name);
  };

  return (
    <SlotCard label={label} hint={hint} wide>
      {attachments.length > 0 && (
        <ul className={styles.list}>
          {attachments.map((attachment) => {
            const name = attachment.original_filename;
            const editing = editingId === attachment.id;
            return (
              <li key={attachment.id} className={styles.item}>
                <FileInfo
                  file={attachment}
                  link
                  nameSlot={
                    editing ? (
                      <RenameInput
                        value={draftName}
                        onChange={setDraftName}
                        onCommit={() => commitRename(attachment)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : undefined
                  }
                />
                <span className={styles.actions}>
                  <Switch
                    label={attachment.published ? 'Zveřejněno' : 'Skryto'}
                    checked={attachment.published}
                    disabled={busy}
                    onChange={(e) => onTogglePublished(attachment, e.target.checked)}
                  />
                  <IconButton
                    icon="pencil"
                    label={`Přejmenovat soubor ${name}`}
                    disabled={busy}
                    onClick={() => startRename(attachment)}
                  />
                  <IconButton
                    icon="close"
                    variant="danger"
                    label={`Odpojit dokument ${name}`}
                    disabled={busy}
                    onClick={() => onRemove(attachment)}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <DropZone
        accept={accept}
        multiple
        busy={busy}
        uploading={uploading}
        onFiles={handleFiles}
        onPickFromLibrary={() => setPickerOpen(true)}
      />

      {pickerOpen && (
        <LibraryPicker
          accept={accept}
          onSelect={(file) => {
            setPickerOpen(false);
            onPickFromLibrary(file);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </SlotCard>
  );
}
