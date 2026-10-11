import { useCallback, useEffect, useRef, useState } from 'react';
import { AttachmentsAPI, ROLE_LABELS } from '../../../config/attachmentsApi.js';
import { LibraryAPI } from '../../../config/libraryApi.js';
import { detachConfirm } from './dialogs/detachConfirm.jsx';

/**
 * Data a akce příloh jednoho vlastníka (závod, příspěvek, sezóna, klub).
 * Každá akce se ukládá hned a po ní se seznam načte znovu; `busyKey` je slot,
 * který právě pracuje (zamkne se jen on).
 *
 * @param {{ownerType: string, ownerId: ?number, onChange?: Function, confirm: Function}} options
 */
export function useAttachments({ ownerType, ownerId, onChange, confirm }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [message, setMessage] = useState(null);

  // Drží se v ref, aby změna identity callbacku nespouštěla nové načtení.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const load = useCallback(async () => {
    if (!ownerId) { setAttachments([]); return; }
    try {
      setLoading(true);
      const data = await AttachmentsAPI.list(ownerType, ownerId);
      setAttachments(data);
      onChangeRef.current?.(data);
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [ownerType, ownerId]);

  useEffect(() => { load(); }, [load]);

  const run = async (key, action, successText) => {
    try {
      setBusyKey(key);
      await action();
      await load();
      if (successText) setMessage({ type: 'success', text: successText });
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    } finally {
      setBusyKey(null);
    }
  };

  const upload = (key, role, file) => run(
    key,
    () => AttachmentsAPI.upload(file, { ownerType, ownerId, role }),
    `${ROLE_LABELS[role]}: soubor nahrán`,
  );

  const link = (key, role, file) => run(
    key,
    () => AttachmentsAPI.link(file.id, { ownerType, ownerId, role }),
    `${ROLE_LABELS[role]}: dokument připojen`,
  );

  const togglePublished = (key, attachment, published) => run(
    key,
    () => AttachmentsAPI.update(attachment.id, { published }),
    published ? 'Dokument zveřejněn' : 'Dokument skryt',
  );

  const changeRole = (key, attachment, role) => run(
    key,
    () => AttachmentsAPI.update(attachment.id, { role }),
    `Změněno na: ${ROLE_LABELS[role]}`,
  );

  // Přejmenovává se soubor, ne příloha: soubor má jediný název a všechna
  // místa, kde je připojený, ho musí vidět stejně.
  const rename = (key, attachment, name) => run(
    key,
    () => LibraryAPI.rename(attachment.file_id, name),
    'Soubor přejmenován',
  );

  const remove = async (key, attachment) => {
    const choice = await confirm(detachConfirm(attachment));
    if (!choice) return;
    await run(
      key,
      () => AttachmentsAPI.remove(attachment.id, { deleteFile: choice === 'delete' }),
      choice === 'delete' ? 'Dokument odpojen a smazán' : 'Dokument odpojen',
    );
  };

  return {
    attachments, loading, busyKey, message, setMessage,
    upload, link, togglePublished, changeRole, rename, remove,
  };
}
