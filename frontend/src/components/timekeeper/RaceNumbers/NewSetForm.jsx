import { Button, Field, Icon, Input, Paska } from '../../ms/index.js';
import ColorSwatches from './ColorSwatches.jsx';
import { newSetPreview } from './raceNumberSets.js';
import styles from './NewSetForm.module.css';

const FIELDS = [
  { key: 'set_number', label: 'Sada', max: 26 },
  { key: 'actual_from', label: 'Reálná od' },
  { key: 'actual_to', label: 'Reálná do' },
];

/** Nová sada dresů (TkCisla, pravý sloupec): rozsah, barva a náhled. */
export default function NewSetForm({ numbersApi }) {
  const { setFormData, updateSetForm, creating, createSet, setShowSetForm } = numbersApi;
  const preview = newSetPreview(setFormData);

  return (
    <form className={styles.form} onSubmit={createSet} aria-labelledby="nova-sada">
      <Paska id="nova-sada">Nová sada</Paska>
      <div className={styles.panel}>
        <div className={styles.fields}>
          {FIELDS.map((field) => (
            <Field key={field.key} label={field.label} id={`nova-sada-${field.key}`}>
              <Input
                size="sm"
                type="number"
                mono
                min="1"
                max={field.max}
                required
                value={setFormData[field.key]}
                onChange={(e) => updateSetForm(field.key, e.target.value)}
              />
            </Field>
          ))}
        </div>
        <div className={styles.color}>
          <span className={styles.caps}>Barva sady</span>
          <ColorSwatches
            label="Barva nové sady"
            value={setFormData.set_color}
            onChange={(color) => updateSetForm('set_color', color)}
          />
        </div>
        {preview && (
          <p className={styles.preview}>
            <Icon name="info" size={18} />
            <span className={styles.previewText}>
              dresy {preview.actualFrom}–{preview.actualTo} →{' '}
              <strong>
                {preview.displayFrom}–{preview.displayTo}
              </strong>
            </span>
            <span className={styles.previewCount}>{preview.count} ks</span>
          </p>
        )}
        <div className={styles.actions}>
          <Button
            type="submit"
            variant="primary"
            icon="check"
            busy={creating}
            className={styles.submit}
          >
            {creating ? 'Vytvářím…' : 'Vytvořit'}
          </Button>
          <Button data-cancel onClick={() => setShowSetForm(false)}>
            Zrušit
          </Button>
        </div>
      </div>
    </form>
  );
}
