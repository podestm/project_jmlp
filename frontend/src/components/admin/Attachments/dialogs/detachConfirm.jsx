import { ROLE_LABELS } from '../../../../config/attachmentsApi.js';
import DetachMessage from './DetachMessage.jsx';

/**
 * Dotaz pro useConfirm před odpojením přílohy (AdminDialogOdpojitPrilohu,
 * AdminDialogOdpojitPropozice). Vrací 'detach' | 'delete' | null.
 * Bezpečná volba „soubor ponechat“ je hlavní a má fokus, smazání stojí vlevo.
 */
export const detachConfirm = (attachment) => ({
  title: `Odpojit ${ROLE_LABELS[attachment.role].toLowerCase()}?`,
  message: <DetachMessage attachment={attachment} />,
  choices: [
    { value: 'detach', label: 'Odpojit, soubor ponechat', icon: 'unlink' },
    { value: 'delete', label: 'Odpojit a smazat soubor', danger: true, icon: 'trash' },
  ],
});
