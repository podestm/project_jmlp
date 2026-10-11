import { Button, Field, Input, Modal } from '../../../ms/index.js';
import { editionPreview, seasonRange } from '../seasons.js';
import styles from './SeasonDialog.module.css';

/**
 * AdminDialogSezona: nová sezóna, nebo úprava existující. Počáteční rok jde
 * zadat jen u nové – váží se na něj závody i dokumenty.
 */
export default function SeasonDialog({ editing, formData, setFormData, saving, onSubmit, onClose }) {
  const set = (name, value) => setFormData({ ...formData, [name]: value });
  const formId = 'sezona-formular';

  return (
    <Modal
      open
      size="sm"
      title={editing ? `Upravit sezónu ${editing.season_label}` : 'Nová sezóna'}
      onClose={onClose}
      footer={(
        <>
          <Button data-cancel onClick={onClose}>Zrušit</Button>
          <Button type="submit" form={formId} variant="primary" icon="check" busy={saving}>
            {editing ? 'Uložit změny' : 'Založit sezónu'}
          </Button>
        </>
      )}
    >
      <form id={formId} className={styles.form} onSubmit={onSubmit}>
        <Field
          label="Počáteční rok"
          required
          hint={`${editing ? 'Rok už nelze změnit — váží se na něj závody i dokumenty. ' : ''}Sezóna poběží ${seasonRange(formData.year_start)}.`}
        >
          <Input type="number" size="sm" mono value={formData.year_start} disabled={Boolean(editing)} onChange={(e) => set('year_start', e.target.value)} />
        </Field>
        <Field label="Ročník" hint="Zobrazí se v hlavičce výsledkové listiny.">
          {(props) => (
            <span className={styles.edition}>
              <Input {...props} type="number" size="sm" mono min="1" value={formData.edition} onChange={(e) => set('edition', e.target.value)} />
              <span className={styles.roman} aria-hidden="true">{editionPreview(formData.edition)}</span>
            </span>
          )}
        </Field>
        <Field label="Název seriálu" required>
          <Input size="sm" value={formData.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
