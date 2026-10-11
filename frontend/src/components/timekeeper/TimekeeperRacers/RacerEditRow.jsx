import { Button, Field, Input, Select } from '../../ms/index.js';
import styles from './RacerEditRow.module.css';

/**
 * Oprava závodníka přímo v tabulce (TkZavodnici, rozbalený řádek): systémové
 * číslo, jméno, ročník, pohlaví a oddíl; pod tím kategorie, kterou server
 * dopočítá po uložení, a chyba čísla. Kategorie se ručně nastavit nedá.
 */
export default function RacerEditRow({ entry, editForm, updateEditField, error, categoryPreview, onSave, onCancel, colSpan }) {
  const id = (field) => `tk-edit-${entry.id}-${field}`;
  const text = (field, label, extra = {}) => (
    <Field label={label} id={id(field)}>
      <Input size="sm" value={editForm[field]} onChange={(e) => updateEditField(field, e.target.value)} {...extra} />
    </Field>
  );

  return (
    <tr data-state="warning" className={styles.row}>
      <td colSpan={colSpan}>
        <div className={styles.grid}>
          <Field label="Systém" id={id('race_number_display')} error={error || undefined}>
            <Input
              size="sm"
              type="number"
              mono
              value={editForm.race_number_display}
              onChange={(e) => updateEditField('race_number_display', e.target.value)}
            />
          </Field>
          {text('racer_name', 'Jméno')}
          {text('racer_surname', 'Příjmení')}
          {text('racer_year', 'Ročník', { type: 'number', mono: true })}
          <Field label="Pohlaví" id={id('racer_sex')}>
            <Select size="sm" value={editForm.racer_sex} onChange={(e) => updateEditField('racer_sex', e.target.value)}>
              <option value="">—</option>
              <option value="1">Muž</option>
              <option value="2">Žena</option>
            </Select>
          </Field>
          {text('club_name', 'Oddíl', { list: 'clubs', placeholder: 'Klub' })}
          <div className={styles.actions}>
            <Button size="sm" variant="primary" onClick={onSave}>Uložit</Button>
            <Button size="sm" data-cancel onClick={onCancel}>Zrušit</Button>
          </div>
        </div>
        <p className={styles.category}>
          <span className={styles.caps}>Kategorie po uložení</span>
          <strong>{categoryPreview(editForm.racer_year, editForm.racer_sex)}</strong>
          <span className={styles.note}>Kategorie se přepočítá z ročníku a pohlaví – ručně ji tu nastavit nejde.</span>
        </p>
      </td>
    </tr>
  );
}
