import { useState } from 'react';
import { Badge, Button, Field, Select, Switch } from '../../../ms/index.js';
import { ROLE_LABELS } from '../../../../config/attachmentsApi.js';
import FileInfo from '../../shared/FileInfo/FileInfo.jsx';
import DropZone from '../DropZone/DropZone.jsx';
import LibraryPicker from '../LibraryPicker/LibraryPicker.jsx';
import SlotCard from '../SlotCard/SlotCard.jsx';
import styles from './AttachmentSlot.module.css';

/**
 * Jeden dokument dané role - obsazený, nebo prázdné místo pro soubor.
 *
 * Používá se tam, kde vlastník smí mít od role nejvýše jeden soubor:
 * závod (propozice, výsledky), příspěvek (obrázek, dokument), klub (logo).
 * roleOptions: slot pokrývá víc vzájemně se vylučujících rolí – výběr typu.
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
  onRemove,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // Typ, se kterým se nahraje nový soubor (jen u slotu s výběrem typu).
  const [pendingRole, setPendingRole] = useState(activeRole);

  const uploadRole = attachment ? attachment.role : pendingRole;
  const busy = uploading || disabled;

  const handleFiles = (fileList) => {
    const file = fileList?.[0];
    if (file) onUpload(file, uploadRole);
  };

  return (
    <SlotCard label={label} hint={hint}>

      {roleOptions && (
        <Field label="Typ dokumentu">
          <Select
            size="sm"
            value={uploadRole}
            disabled={busy}
            onChange={(e) => {
              const role = e.target.value;
              setPendingRole(role);
              if (attachment) onRoleChange(role);
            }}
          >
            {roleOptions.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
          </Select>
        </Field>
      )}

      {attachment ? (
        <>
          <FileInfo file={attachment} link>
            {attachment.is_generated && <Badge size="sm" tone="navy">vygenerováno</Badge>}
          </FileInfo>
          <div className={styles.actions}>
            <Switch
              label={attachment.published ? 'Zveřejněno' : 'Skryto'}
              checked={attachment.published}
              disabled={busy}
              onChange={(e) => onTogglePublished(e.target.checked)}
            />
            <span className={styles.buttons}>
              <Button size="sm" disabled={busy} onClick={() => setPickerOpen(true)}>Z knihovny</Button>
              <Button size="sm" variant="danger" disabled={busy} onClick={onRemove} aria-label={`Odpojit dokument ${attachment.original_filename}`}>
                Odpojit
              </Button>
            </span>
          </div>
        </>
      ) : (
        <DropZone accept={accept} busy={busy} uploading={uploading} onFiles={handleFiles} onPickFromLibrary={() => setPickerOpen(true)} />
      )}

      {pickerOpen && (
        <LibraryPicker
          accept={accept}
          onSelect={(file) => { setPickerOpen(false); onPickFromLibrary(file, uploadRole); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </SlotCard>
  );
}
