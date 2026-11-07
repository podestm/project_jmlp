import { formatFileSize } from '../../../../utils/files.js';
import { formatDateShort } from '../../../../utils/date.js';
import FileBadge from '../FileBadge/FileBadge.jsx';
import styles from './FileInfo.module.css';

/**
 * Soubor přílohy: štítek přípony, název (odkaz, nebo `nameSlot` místo něj –
 * pole pro přejmenování), velikost a datum nahrání; `children` vpravo pod
 * údaji (štítek „vygenerováno“).
 */
export default function FileInfo({ file, link = false, nameSlot, children }) {
  const name = file.original_filename;
  const details = [
    formatFileSize(file.file_size),
    file.uploaded_at && `nahráno ${formatDateShort(file.uploaded_at)}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <span className={styles.file}>
      <FileBadge filename={name} />
      <span className={styles.text}>
        {nameSlot ??
          (link ? (
            <a
              href={file.download_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
              title={name}
            >
              {name}
            </a>
          ) : (
            <span className={styles.name}>{name}</span>
          ))}
        <span className={styles.details}>
          <span>{details}</span>
          {children}
        </span>
      </span>
    </span>
  );
}
