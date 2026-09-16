import { useCallback, useEffect, useRef, useState } from 'react';
import Alert from '../../ui/Alert.jsx';
import LoadingState from '../../ui/LoadingState.jsx';
import AttachmentSlot from './AttachmentSlot.jsx';
import AttachmentList from './AttachmentList.jsx';
import { useConfirm } from '../../../hooks/useConfirm.jsx';
import { AttachmentsAPI, exclusiveGroup, ROLE, ROLE_LABELS } from '../../../config/attachmentsApi.js';
import { LibraryAPI } from '../../../config/libraryApi.js';

const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.txt';
const IMAGE_ACCEPT = '.jpg,.jpeg,.png';

/** Popisek slotu, který pokrývá víc vzájemně se vylučujících rolí. */
const GROUP_LABELS = {
  [`${ROLE.vysledky}+${ROLE.prubezne}`]: 'Výsledky sezóny'
};

/** Popisky a nápovědy jednotlivých rolí - jedno místo pro celou administraci. */
const SLOT_CONFIG = {
  [ROLE.propozice]: { accept: DOCUMENT_ACCEPT, hint: 'Zveřejní se u závodu jako propozice' },
  [ROLE.vysledky]: { accept: DOCUMENT_ACCEPT, hint: 'Zveřejní se u závodu jako výsledková listina' },
  [ROLE.prubezne]: { accept: DOCUMENT_ACCEPT, hint: 'Průběžné pořadí sezóny' },
  [ROLE.document]: {
    accept: DOCUMENT_ACCEPT,
    hint: 'Zveřejní se na /dokumenty, název souboru je zároveň popiskem odkazu'
  },
  [ROLE.image]: { accept: IMAGE_ACCEPT, hint: 'Obrázek zobrazený u příspěvku' },
  [ROLE.logo]: { accept: IMAGE_ACCEPT, hint: 'Logo klubu, použije se v hlavičce výsledkové listiny' }
};

/**
 * Správa dokumentů jedné věci - závodu, příspěvku, sezóny nebo klubu.
 *
 *   <AttachmentManager ownerType="race" ownerId={raceId}
 *                      roles={['propozice', 'vysledky']} />
 *
 * Prvek `roles` může být i pole rolí, které se vzájemně vylučují - pak vznikne
 * jeden slot s přepínačem typu:
 *
 *   <AttachmentManager ownerType="season" ownerId={2025}
 *                      roles={[['vysledky', 'prubezne']]} />
 *
 * Soubor se nahrává rovnou k vlastníkovi, není potřeba ho nejdřív dávat do
 * knihovny. Které role jsou povolené, hlídá i backend (ATTACHMENT_ROLES_BY_OWNER).
 *
 * `ownerId` může být zpočátku null (nový, dosud neuložený závod) - komponenta
 * pak jen vysvětlí, že je potřeba věc nejdřív uložit.
 *
 * `stacked` dá sloty pod sebe i na širokém displeji - pro úzký sloupec
 * formuláře, kde by se dva sloty vedle sebe nevešly.
 */
export default function AttachmentManager({
  ownerType,
  ownerId,
  roles,
  title = 'Dokumenty',
  stacked = false,
  onChange
}) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyRole, setBusyRole] = useState(null);
  const [message, setMessage] = useState(null);
  const { confirm, confirmElement } = useConfirm();

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

  // Prvek `roles` může být string nebo pole vzájemně se vylučujících rolí.
  // Role mimo jakoukoli vylučovací skupinu smí mít víc dokumentů -> seznam.
  const slots = roles.map((entry) => {
    const groupRoles = Array.isArray(entry) ? entry : [entry];
    const single = groupRoles.length > 1 || Boolean(exclusiveGroup(ownerType, groupRoles[0]));
    return { key: groupRoles.join('+'), roles: groupRoles, single };
  });

  const findInGroup = (groupRoles) =>
    attachments.find((item) => groupRoles.includes(item.role)) || null;

  const run = async (key, action, successText) => {
    try {
      setBusyRole(key);
      await action();
      await load();
      if (successText) setMessage({ type: 'success', text: successText });
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    } finally {
      setBusyRole(null);
    }
  };

  const handleUpload = (key, role, file) => run(
    key,
    () => AttachmentsAPI.upload(file, { ownerType, ownerId, role }),
    `${ROLE_LABELS[role]}: soubor nahrán`
  );

  const handleLink = (key, role, file) => run(
    key,
    () => AttachmentsAPI.link(file.id, { ownerType, ownerId, role }),
    `${ROLE_LABELS[role]}: dokument připojen`
  );

  const handleTogglePublished = (key, attachment, published) => run(
    key,
    () => AttachmentsAPI.update(attachment.id, { published }),
    published ? 'Dokument zveřejněn' : 'Dokument skryt'
  );

  const handleRoleChange = (key, attachment, role) => run(
    key,
    () => AttachmentsAPI.update(attachment.id, { role }),
    `Změněno na: ${ROLE_LABELS[role]}`
  );

  // Přejmenovává se soubor, ne příloha: soubor má jediný název a všechna
  // místa, kde je připojený, ho musí vidět stejně.
  const handleRename = (key, attachment, name) => run(
    key,
    () => LibraryAPI.rename(attachment.file_id, name),
    'Soubor přejmenován'
  );

  const handleRemove = async (key, attachment) => {
    const choice = await confirm({
      title: `Odpojit ${ROLE_LABELS[attachment.role].toLowerCase()}?`,
      message: `Soubor „${attachment.original_filename}" přestane být u této položky zveřejněný.`,
      choices: [
        { value: 'detach', label: 'Odpojit, soubor ponechat', variant: 'primary', icon: 'bi-box-arrow-up' },
        { value: 'delete', label: 'Odpojit a smazat soubor', variant: 'danger', icon: 'bi-trash' }
      ]
    });
    if (!choice) return;

    await run(
      key,
      () => AttachmentsAPI.remove(attachment.id, { deleteFile: choice === 'delete' }),
      choice === 'delete' ? 'Dokument odpojen a smazán' : 'Dokument odpojen'
    );
  };

  if (!ownerId) {
    return (
      <div className="border rounded p-3 bg-light">
        <h6 className="mb-1">{title}</h6>
        <small className="text-muted">
          Dokumenty půjde nahrát hned po prvním uložení.
        </small>
      </div>
    );
  }

  return (
    <div>
      <h6 className="mb-2">{title}</h6>

      {message && (
        <Alert
          key={message.text}
          type={message.type}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      )}

      {loading && attachments.length === 0 ? (
        <LoadingState variant="inline" label="Načítám dokumenty…" />
      ) : (
        <div className="row">
          {slots.map(({ key, roles: groupRoles, single }) => {
            if (!single) {
              const role = groupRoles[0];
              const config = SLOT_CONFIG[role] || { accept: DOCUMENT_ACCEPT, hint: '' };
              const items = attachments.filter((item) => item.role === role);
              return (
                <div className="col-12" key={key}>
                  <AttachmentList
                    label={ROLE_LABELS[role]}
                    hint={config.hint}
                    accept={config.accept}
                    attachments={items}
                    uploading={busyRole === key}
                    onUpload={(file) => handleUpload(key, role, file)}
                    onPickFromLibrary={(file) => handleLink(key, role, file)}
                    onRename={(item, name) => handleRename(key, item, name)}
                    onTogglePublished={(item, published) => handleTogglePublished(key, item, published)}
                    onRemove={(item) => handleRemove(key, item)}
                  />
                </div>
              );
            }

            const attachment = findInGroup(groupRoles);
            // U skupiny se role řídí připojeným dokumentem, jinak první z nabídky.
            const activeRole = attachment?.role || groupRoles[0];
            const config = SLOT_CONFIG[activeRole] || { accept: DOCUMENT_ACCEPT, hint: '' };
            const isGroup = groupRoles.length > 1;
            return (
              <div className={slots.length > 1 && !stacked ? 'col-md-6' : 'col-12'} key={key}>
                <AttachmentSlot
                  label={isGroup ? GROUP_LABELS[key] || ROLE_LABELS[activeRole] : ROLE_LABELS[activeRole]}
                  hint={config.hint}
                  accept={config.accept}
                  attachment={attachment}
                  roleOptions={isGroup ? groupRoles : null}
                  activeRole={activeRole}
                  uploading={busyRole === key}
                  onUpload={(file, role) => handleUpload(key, role || activeRole, file)}
                  onPickFromLibrary={(file, role) => handleLink(key, role || activeRole, file)}
                  onRoleChange={(role) => handleRoleChange(key, attachment, role)}
                  onRemove={() => handleRemove(key, attachment)}
                  onTogglePublished={(published) => handleTogglePublished(key, attachment, published)}
                />
              </div>
            );
          })}
        </div>
      )}

      {confirmElement}
    </div>
  );
}
