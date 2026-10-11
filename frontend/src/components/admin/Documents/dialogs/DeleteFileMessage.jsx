import { Icon } from '../../../ms/index.js';
import { formatDateShort } from '../../../../utils/date.js';
import { formatFileSize } from '../../../../utils/files.js';
import FileInfo from '../../shared/FileInfo/FileInfo.jsx';
import { usageText } from '../documents.js';
import styles from './DeleteFileMessage.module.css';

/**
 * Tělo AdminDialogSmazatSoubor: nepoužitý soubor ukáže kartou, použitý
 * vyjmenuje místa, odkud zmizí, a poradí, jak ho jen vyměnit.
 */
export default function DeleteFileMessage({ file }) {
  const usage = file.usage_info || [];
  const details = `${formatFileSize(file.file_size)}, nahráno ${formatDateShort(file.uploaded_at)}`;

  if (usage.length === 0) {
    return (
      <div className={styles.body}>
        <p className={styles.text}>Soubor se smaže z knihovny i z disku. Vrátit to nejde.</p>
        <div className={styles.card}>
          <FileInfo file={file}><span>nikde se nepoužívá</span></FileInfo>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.body}>
      <p className={styles.text}>
        Soubor ({details}) je použitý. Smazáním zmizí i z těchto míst, včetně veřejného webu:
      </p>
      <ul className={styles.usage}>
        {usage.map((item, index) => (
          <li key={`${item.owner_type}-${item.owner_id}-${item.role}-${index}`} className={styles.usageItem}>
            <span className={styles.name}>{usageText(item)}</span>
            <span className={styles.meta}>{item.published ? 'zveřejněno' : 'skryto'}</span>
          </li>
        ))}
      </ul>
      <p className={styles.tip}>
        <Icon name="info" size={18} />
        Chcete ho jen nahradit novější verzí? Nahrajte novou u vlastníka a tuhle pak odpojte.
      </p>
    </div>
  );
}
