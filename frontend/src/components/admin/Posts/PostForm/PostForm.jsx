import { useState } from 'react';
import { OWNER, ROLE } from '../../../../config/attachmentsApi.js';
import { Alert, Button, Checkbox, Field, Input, Paska, RadioTiles, Textarea } from '../../../ms/index.js';
import AttachmentManager from '../../Attachments/AttachmentManager.jsx';
import { IMAGE_POSITIONS } from '../posts.js';
import styles from './PostForm.module.css';

// Příspěvek má nejvýše jeden obrázek a nejvýše jeden dokument - obojí řeší
// jeden AttachmentManager, backend stejné omezení hlídá taky.
const POST_ROLES = [ROLE.image, ROLE.document];

/**
 * Formulář příspěvku (AdminPrispevekForm): text, publikování, přílohy
 * a pozice obrázku. Přílohy se ukládají hned; u nového příspěvku až po
 * prvním uložení (formulář pak zůstane otevřený jako úprava).
 */
export default function PostForm({ editingPost, formData, setFormData, handleSubmit, closeForm, error, setError, success, setSuccess }) {
  // Pozice obrázku má smysl jen když nějaký obrázek připojený je. Stav
  // příloh zná AttachmentManager, proto si ho posílá zpátky přes onChange.
  const [hasImage, setHasImage] = useState(false);
  const set = (name, value) => setFormData({ ...formData, [name]: value });

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-label={editingPost ? 'Upravit příspěvek' : 'Nový příspěvek'}>
      {error && <Alert type="danger" compact title={error} onDismiss={() => setError('')} />}
      {success && <Alert key={success} type="success" compact title={success} onDismiss={() => setSuccess('')} />}

      <section className={styles.section} aria-labelledby="prispevek-text">
        <Paska id="prispevek-text">Text příspěvku</Paska>
        <Field label="Nadpis" required>
          <Input size="sm" value={formData.title} onChange={(e) => set('title', e.target.value)} placeholder="Zadejte nadpis příspěvku..." />
        </Field>
        <Field label="Obsah" required hint="Pro formátování textu můžete použít: **tučný text**, *kurzíva*.">
          <Textarea rows={10} value={formData.content} onChange={(e) => set('content', e.target.value)} placeholder="Napište obsah příspěvku..." />
        </Field>
        <Checkbox
          label="Publikovat příspěvek"
          description="Zaškrtnuté = příspěvek je hned vidět v Aktualitách. Odškrtnuté = zůstane jako koncept jen pro vás."
          checked={formData.published}
          onChange={(e) => set('published', e.target.checked)}
          className={styles.publish}
        />
      </section>

      <section className={styles.section} aria-labelledby="prispevek-prilohy">
        <Paska id="prispevek-prilohy">Přílohy</Paska>
        <AttachmentManager
          ownerType={OWNER.post}
          ownerId={editingPost?.id || null}
          roles={POST_ROLES}
          onChange={(items) => setHasImage(items.some((item) => item.role === ROLE.image))}
        />
        {hasImage && (
          <RadioTiles
            label="Pozice obrázku"
            options={IMAGE_POSITIONS}
            value={formData.image_position}
            onChange={(value) => set('image_position', value)}
            className={styles.position}
          />
        )}
      </section>

      <div className={styles.footer}>
        <Button onClick={closeForm}>Zrušit</Button>
        <Button type="submit" variant="primary" icon="save">{editingPost ? 'Uložit příspěvek' : 'Vytvořit příspěvek'}</Button>
      </div>
    </form>
  );
}
