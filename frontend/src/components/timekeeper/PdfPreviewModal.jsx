import { Button, Modal } from '../ms/index.js';
import styles from './PdfPreviewModal.module.css';

/**
 * Náhled vygenerované listiny (startovní i výsledkové) a druhé potvrzení
 * před publikací (TkDialogNahled*).
 *
 * Modál, ne window.open: blob vzniká asynchronně až po kliknutí, takže
 * nové okno by prohlížeč spolehlivě zablokoval jako popup.
 *
 * Stažení i tisk má vestavěný prohlížeč PDF, zavírá křížek nahoře – dole
 * zůstává jen to, co prohlížeč neumí: publikace. Během publikace dialog
 * zavřít nejde.
 */
export default function PdfPreviewModal({
  objectUrl,
  title,
  canPublish = false,
  publishLabel = 'Publikovat k závodu',
  publishing = false,
  onPublish,
  onClose
}) {
  return (
    <Modal
      open
      size="full"
      flush
      eyebrow="Náhled listiny"
      title={title}
      closeLabel="Zavřít náhled"
      dismissible={!publishing}
      onClose={() => onClose()}
      footer={canPublish && (
        <Button variant="primary" icon="upload" busy={publishing} onClick={onPublish}>
          {publishLabel}
        </Button>
      )}
    >
      <iframe src={objectUrl} title={title} className={styles.frame} />
    </Modal>
  );
}
