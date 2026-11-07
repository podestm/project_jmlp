import { Badge, Button, ButtonLink, IconButton, Table, TableScroll } from '../../../ms/index.js';
import { formatDateShort } from '../../../../utils/date.js';
import { formatFileSize } from '../../../../utils/files.js';
import FileBadge from '../../shared/FileBadge/FileBadge.jsx';
import RenameInput from '../../shared/RenameInput/RenameInput.jsx';
import { usageLabel } from '../documents.js';
import styles from './FileTable.module.css';

/** Název souboru, nebo pole pro nový název. */
function FileName({ file, editing, draftName, setDraftName, onCommit, onCancel }) {
  if (editing) {
    return (
      <RenameInput
        value={draftName}
        onChange={setDraftName}
        onCommit={() => onCommit(file)}
        onCancel={onCancel}
      />
    );
  }
  return (
    <a
      href={file.download_url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.link}
      title={file.original_filename}
    >
      {file.original_filename}
    </a>
  );
}

/** Kde je soubor použitý: štítek na každé místo, stav slovy. */
function FileUsage({ usage }) {
  if (!usage?.length) return <span className={styles.muted}>Nikde se nepoužívá</span>;
  return (
    <span className={styles.usage}>
      {usage.map((item, index) => (
        <span
          key={`${item.owner_type}-${item.owner_id}-${item.role}-${index}`}
          title={`${item.type}: ${item.title}`}
        >
          <Badge size="sm" tone={item.published ? 'open' : 'neutral'}>
            {usageLabel(item)}
          </Badge>
        </span>
      ))}
    </span>
  );
}

function FileRow({ file, rename, onPublish, onDelete }) {
  const name = file.original_filename;
  return (
    <tr>
      <td className={styles.fileCell}>
        <span className={styles.file}>
          <FileBadge filename={name} />
          <FileName file={file} editing={rename.editingId === file.id} {...rename} />
        </span>
      </td>
      <td data-align="end" data-numeric className={styles.size}>
        {formatFileSize(file.file_size)}
      </td>
      <td className={styles.date}>{formatDateShort(file.uploaded_at)}</td>
      <td className={styles.usageCell}>
        <FileUsage usage={file.usage_info} />
      </td>
      <td data-align="end" className={styles.actionsCell}>
        <span className={styles.actions}>
          <IconButton
            icon="pencil"
            label={`Přejmenovat soubor ${name}`}
            onClick={() => rename.onStart(file)}
          />
          <ButtonLink
            href={file.download_url}
            download
            size="sm"
            icon="download"
            className={styles.square}
            aria-label={`Stáhnout soubor ${name}`}
          />
          <Button
            size="sm"
            onClick={() => onPublish(file)}
            aria-label={`Zveřejnit soubor ${name} na webu`}
          >
            Zveřejnit
          </Button>
          <IconButton
            icon="trash"
            variant="danger"
            label={`Smazat soubor ${name}`}
            onClick={() => onDelete(file)}
          />
        </span>
      </td>
    </tr>
  );
}

/**
 * Tabulka souborů knihovny (AdminDokumenty). Pod 768 px se řádky skládají
 * pod sebe jako karty – jedno markup, přejmenování v řádku funguje všude.
 * rename: { editingId, draftName, setDraftName, onStart, onCommit, onCancel }
 */
export default function FileTable({ files, rename, onPublish, onDelete }) {
  return (
    <TableScroll label="Soubory knihovny">
      <Table caption="Soubory knihovny" className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Soubor</th>
            <th scope="col" data-align="end">
              Velikost
            </th>
            <th scope="col">Nahráno</th>
            <th scope="col">Použito</th>
            <th scope="col" data-align="end">
              Akce
            </th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              rename={rename}
              onPublish={onPublish}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </Table>
    </TableScroll>
  );
}
