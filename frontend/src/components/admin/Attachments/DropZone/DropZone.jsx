import { useRef, useState } from 'react';
import { Button, Icon, Spinner } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import styles from './DropZone.module.css';

/**
 * Místo pro soubor (AdminPrilohy): přerušovaný rámeček, do kterého jde
 * soubor přetáhnout, a tlačítka Vybrat z počítače / Vybrat z knihovny.
 * Při nahrávání ukáže kolečko a zamkne se.
 * - onFiles(FileList): vybrané nebo přetažené soubory
 * - multiple: víc souborů naráz (seznam obecných dokumentů)
 */
export default function DropZone({ accept, multiple = false, busy = false, uploading = false, onFiles, onPickFromLibrary }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    if (!busy) onFiles(event.dataTransfer.files);
  };

  return (
    <div
      className={cx(styles.zone, dragOver && styles.over)}
      onDragOver={(event) => { event.preventDefault(); if (!busy) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {uploading ? (
        <span className={styles.uploading} role="status"><Spinner size={18} />Nahrávám…</span>
      ) : (
        <>
          <span className={styles.text}>
            <Icon name="upload" size={18} />
            {multiple ? 'Přetáhněte soubory sem, nebo' : 'Přetáhněte soubor sem, nebo'}
          </span>
          <span className={styles.actions}>
            <Button size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>Vybrat z počítače</Button>
            <Button size="sm" disabled={busy} onClick={onPickFromLibrary}>Vybrat z knihovny</Button>
          </span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        disabled={busy}
        onChange={(event) => { onFiles(event.target.files); event.target.value = ''; }}
      />
    </div>
  );
}
