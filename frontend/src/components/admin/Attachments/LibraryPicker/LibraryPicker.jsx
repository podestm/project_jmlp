import { useEffect, useState } from 'react';
import { Alert, Badge, Button, EmptyState, Field, Input, LoadingState, Modal } from '../../../ms/index.js';
import { AttachmentsAPI } from '../../../../config/attachmentsApi.js';
import FileInfo from '../../shared/FileInfo/FileInfo.jsx';
import { acceptText, filterLibrary } from '../attachments.js';
import styles from './LibraryPicker.module.css';

/**
 * Výběr už nahraného souboru z knihovny (AdminDialogVyberZKnihovny,
 * AdminDialogKnihovnaZavod). Klik na soubor ho rovnou připojí – mezikrok
 * s potvrzením kód nemá. Nabízí jen přípony, které role bere.
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

  const visibleFiles = filterLibrary(files, accept, query);

  return (
    <Modal
      open
      size="lg"
      title="Vybrat z knihovny"
      onClose={() => onClose()}
      footer={<Button data-cancel onClick={onClose}>Zavřít</Button>}
    >
      <div className={styles.body}>
        <Field label="Hledat podle názvu" hint={acceptText(accept)}>
          <Input type="search" size="sm" value={query} onChange={(e) => setQuery(e.target.value)} data-autofocus />
        </Field>

        {error && <Alert type="danger" compact title={error} />}
        {loading && <LoadingState variant="inline" label="Načítám knihovnu…" />}

        {!loading && !error && visibleFiles.length === 0 && (
          <EmptyState
            icon="folder"
            title="Žádný odpovídající soubor"
            hint="Zkuste jiný výraz, nebo soubor rovnou nahrajte přetažením."
            action={query && <Button size="sm" onClick={() => setQuery('')}>Vymazat hledání</Button>}
          />
        )}

        {!loading && visibleFiles.length > 0 && (
          <ul className={styles.list}>
            {visibleFiles.map((file) => (
              <li key={file.id}>
                <button type="button" className={styles.option} onClick={() => onSelect(file)}>
                  <FileInfo file={file}>
                    {file.usage_info?.length > 0 && (
                      <span title={file.usage_info.map((u) => `${u.type}: ${u.title}`).join('\n')}>
                        <Badge size="sm">použit {file.usage_info.length}×</Badge>
                      </span>
                    )}
                  </FileInfo>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
