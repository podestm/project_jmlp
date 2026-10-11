import { Field, Input, Select } from '../../ms/index.js';
import InlineEditRow from '../InlineEditRow/InlineEditRow.jsx';

const COLUMNS = '100px repeat(2, minmax(0, 1fr)) 90px 120px minmax(0, 1.4fr) auto';

/**
 * Oprava závodníka přímo v tabulce (TkZavodnici): systémové číslo, jméno,
 * ročník, pohlaví a oddíl (nabídka klubů z datalistu #clubs).
 */
export default function RacerEditRow({ entry, editForm, updateEditField, error, categoryPreview, onSave, onCancel, colSpan }) {
  const id = (field) => `tk-edit-${entry.id}-${field}`;
  const text = (field, label, extra = {}) => (
    <Field label={label} id={id(field)}>
      <Input size="sm" value={editForm[field]} onChange={(e) => updateEditField(field, e.target.value)} {...extra} />
    </Field>
  );

  return (
    <InlineEditRow
      colSpan={colSpan}
      columns={COLUMNS}
      categoryPreview={categoryPreview(editForm.racer_year, editForm.racer_sex)}
      onSave={onSave}
      onCancel={onCancel}
    >
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
    </InlineEditRow>
  );
}
