import { Field, Input } from '../../ms/index.js';
import InlineEditRow from '../InlineEditRow/InlineEditRow.jsx';

const COLUMNS = '80px 120px repeat(2, minmax(0, 1fr)) 90px minmax(0, 1.4fr) auto';

/**
 * Oprava řádku startovní listiny (TkStartovniListina): pořadí na startu,
 * systémové číslo (s dresem, který z něj vyjde, a kontrolou obsazenosti),
 * jméno, ročník a oddíl.
 */
export default function StartListEditRow({
  entry,
  editForm,
  updateEditField,
  error,
  bibNumber,
  categoryPreview,
  onSave,
  onCancel,
  colSpan,
}) {
  const id = (field) => `tk-sl-${entry.id}-${field}`;
  const text = (field, label, extra = {}) => (
    <Field label={label} id={id(field)}>
      <Input
        size="sm"
        value={editForm[field]}
        onChange={(e) => updateEditField(field, e.target.value)}
        {...extra}
      />
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
      {text('start_number', 'Pořadí', { type: 'number', mono: true })}
      <Field
        label="Systém"
        id={id('race_number_display')}
        error={error || undefined}
        hint={`Číslo dresu: ${bibNumber ?? '—'}`}
      >
        <Input
          size="sm"
          mono
          placeholder="A12"
          maxLength={6}
          autoCapitalize="characters"
          value={editForm.race_number_display}
          onChange={(e) => updateEditField('race_number_display', e.target.value.toUpperCase())}
        />
      </Field>
      {text('racer_name', 'Jméno')}
      {text('racer_surname', 'Příjmení')}
      {text('racer_year', 'Ročník', { type: 'number', mono: true })}
      {text('club_name', 'Oddíl', { placeholder: 'Klub' })}
    </InlineEditRow>
  );
}
