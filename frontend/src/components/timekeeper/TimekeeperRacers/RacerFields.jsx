import { Field, Input, Select } from '../../ms/index.js';
import styles from './RacerFields.module.css';

/**
 * Údaje závodníka ve formuláři „Přidat závodníka“ (kopie pro časomíru,
 * veřejná přihláška má vlastní). Oddíl je volný text s nabídkou klubů
 * v <datalist id="clubs">, který používá i oprava řádku v tabulce.
 * `searchResults` se vykreslí hned pod jménem – hledá se podle něj.
 */
export default function RacerFields({ formData, updateField, clubs, searchResults }) {
  return (
    <div className={styles.grid}>
      <Field label="Příjmení" id="tk-racer-surname">
        <Input
          size="sm"
          value={formData.surname}
          onChange={(e) => updateField('surname', e.target.value)}
        />
      </Field>
      <Field label="Jméno" id="tk-racer-name">
        <Input
          size="sm"
          value={formData.name}
          onChange={(e) => updateField('name', e.target.value)}
        />
      </Field>

      {searchResults && <div className={styles.full}>{searchResults}</div>}

      <Field label="Rok narození" id="tk-racer-year">
        <Input
          size="sm"
          type="number"
          mono
          placeholder="RRRR"
          min="1900"
          max={new Date().getFullYear()}
          value={formData.year}
          onChange={(e) => updateField('year', Number(e.target.value))}
        />
      </Field>
      <Field label="Pohlaví" id="tk-racer-sex">
        <Select
          size="sm"
          value={formData.sex}
          onChange={(e) => updateField('sex', e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="" disabled>
            — vyberte —
          </option>
          <option value={1}>Muž</option>
          <option value={2}>Žena</option>
        </Select>
      </Field>

      <Field label="Oddíl" id="tk-racer-club">
        <Input
          size="sm"
          list="clubs"
          placeholder="Název klubu"
          value={formData.club || ''}
          onChange={(e) => updateField('club', e.target.value)}
        />
      </Field>
      <datalist id="clubs">
        {clubs.map((club) => (
          <option key={club.id} value={club.name} />
        ))}
      </datalist>
      <Field label="SLČR ID" id="tk-racer-slcr">
        <Input
          size="sm"
          mono
          placeholder="nepovinné"
          inputMode="numeric"
          maxLength="6"
          pattern="\d{0,6}"
          value={formData.slcr_id}
          onChange={(e) => updateField('slcr_id', e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </Field>
    </div>
  );
}
