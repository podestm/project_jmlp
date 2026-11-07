import { useConfirm } from '../../../hooks/useConfirm.jsx';
import { Alert, LoadingState } from '../../ms/index.js';
import { cx } from '../../ms/cx.js';
import AttachmentList from './AttachmentList/AttachmentList.jsx';
import AttachmentSlot from './AttachmentSlot/AttachmentSlot.jsx';
import { buildSlots, slotConfig, slotLabel } from './attachments.js';
import { useAttachments } from './useAttachments.js';
import styles from './AttachmentManager.module.css';

/**
 * Správa dokumentů jedné věci - závodu, příspěvku, sezóny nebo klubu
 * (AdminPrilohy, AdminDialogOdpojitPrilohu, AdminDialogVyberZKnihovny).
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
 * pak jen řekne, že je potřeba věc nejdřív uložit.
 *
 * `stacked` dá sloty pod sebe i na širokém displeji - pro úzký sloupec
 * formuláře, kde by se dva sloty vedle sebe nevešly. `title` je nadpis nad
 * sloty (bez něj žádný – nadpis dává obrazovka sama).
 */
export default function AttachmentManager({
  ownerType,
  ownerId,
  roles,
  title,
  stacked = false,
  onChange,
}) {
  // Hook sám nic nerenderuje, dialog proto vlastní tahle komponenta.
  const { confirm, confirmElement } = useConfirm();
  const am = useAttachments({ ownerType, ownerId, onChange, confirm });

  if (!ownerId) {
    return (
      <div className={styles.unsaved}>
        {title && <h3 className={styles.title}>{title}</h3>}
        <p className={styles.unsavedText}>Nahrát půjde po uložení.</p>
      </div>
    );
  }

  const slots = buildSlots(ownerType, roles);

  const renderSlot = (slot) => {
    const { key, roles: groupRoles } = slot;
    if (!slot.single) {
      const role = groupRoles[0];
      const config = slotConfig(role);
      return (
        <AttachmentList
          key={key}
          label={slotLabel(slot, role)}
          hint={config.hint}
          accept={config.accept}
          attachments={am.attachments.filter((item) => item.role === role)}
          uploading={am.busyKey === key}
          onUpload={(file) => am.upload(key, role, file)}
          onPickFromLibrary={(file) => am.link(key, role, file)}
          onRename={(item, name) => am.rename(key, item, name)}
          onTogglePublished={(item, published) => am.togglePublished(key, item, published)}
          onRemove={(item) => am.remove(key, item)}
        />
      );
    }

    const attachment = am.attachments.find((item) => groupRoles.includes(item.role)) || null;
    // U skupiny se role řídí připojeným dokumentem, jinak první z nabídky.
    const activeRole = attachment?.role || groupRoles[0];
    const config = slotConfig(activeRole);
    return (
      <AttachmentSlot
        key={key}
        label={slotLabel(slot, activeRole)}
        hint={config.hint}
        accept={config.accept}
        attachment={attachment}
        roleOptions={groupRoles.length > 1 ? groupRoles : null}
        activeRole={activeRole}
        uploading={am.busyKey === key}
        onUpload={(file, role) => am.upload(key, role || activeRole, file)}
        onPickFromLibrary={(file, role) => am.link(key, role || activeRole, file)}
        onRoleChange={(role) => am.changeRole(key, attachment, role)}
        onRemove={() => am.remove(key, attachment)}
        onTogglePublished={(published) => am.togglePublished(key, attachment, published)}
      />
    );
  };

  return (
    <div className={styles.manager}>
      {title && <h3 className={styles.title}>{title}</h3>}
      {am.message && (
        <Alert
          key={am.message.text}
          type={am.message.type}
          compact
          title={am.message.text}
          onDismiss={() => am.setMessage(null)}
        />
      )}
      {am.loading && am.attachments.length === 0 ? (
        <LoadingState variant="inline" label="Načítám dokumenty…" />
      ) : (
        <div className={cx(styles.slots, stacked && styles.stacked)}>{slots.map(renderSlot)}</div>
      )}
      {confirmElement}
    </div>
  );
}
