import { Badge, Button, Field, Input, Paska, Tooltip } from '../../ms/index.js';
import BibNumber from '../BibNumber/BibNumber.jsx';
import RacerFields from './RacerFields.jsx';
import RacerSearchResults from './RacerSearchResults.jsx';
import { racerSearchQuery } from './racers.js';
import styles from './AddRacerForm.module.css';

/**
 * „Přidat závodníka“ (TkZavodnici, levý panel): údaje s hledáním
 * v databázi, systémové číslo s návrhem a kontrolou, náhled dresu
 * a kategorie. Dopisuje se jen do startovky, ne do registrací.
 */
export default function AddRacerForm({ racers }) {
  const {
    formData, updateField, clubs, resetForm, addRacer, submitting,
    searchResults, isSearching, selectedRacer, selectExistingRacer,
    liveRaceNumberError, nextRaceNumber, selectedRaceNumberOption, categoryPreview,
  } = racers;

  const handleSubmit = (e) => {
    e.preventDefault();
    addRacer();
  };

  return (
    <form className={styles.panel} onSubmit={handleSubmit} aria-labelledby="pridat-zavodnika">
      <Paska id="pridat-zavodnika">Přidat závodníka</Paska>

      <RacerFields
        formData={formData}
        updateField={updateField}
        clubs={clubs}
        searchResults={<RacerSearchResults racers={searchResults} isSearching={isSearching} hasQuery={Boolean(racerSearchQuery(formData))} onSelect={selectExistingRacer} />}
      />

      <div className={styles.numbers}>
        <Field
          label="Systémové číslo"
          id="tk-racer-number"
          error={liveRaceNumberError || undefined}
          hint={liveRaceNumberError ? undefined : `Návrh dalšího volného čísla: ${nextRaceNumber || '—'}`}
        >
          <Input
            size="sm"
            type="number"
            mono
            placeholder="Automatický návrh"
            value={formData.race_number_display}
            onChange={(e) => updateField('race_number_display', e.target.value)}
          />
        </Field>
        <div className={styles.bib}>
          <span className={styles.caps}>Číslo dresu</span>
          <span className={styles.bibRow}>
            <BibNumber number={selectedRaceNumberOption?.actual_number} setColor={selectedRaceNumberOption?.set_color} />
            <span className={styles.set}>
              {selectedRaceNumberOption ? `Sada ${selectedRaceNumberOption.set_number}` : 'Bez sady'}
            </span>
          </span>
        </div>
      </div>

      <div className={styles.status}>
        {selectedRacer && (
          <Badge tone="navy" size="sm" icon="check">Vybrán: {selectedRacer.surname} {selectedRacer.name}</Badge>
        )}
        <Badge tone="dry" size="sm" icon="tag">Kategorie: {categoryPreview(formData.year, formData.sex)}</Badge>
      </div>

      <div className={styles.actions}>
        <Button icon="x-circle" onClick={() => resetForm()}>Vymazat</Button>
        <Tooltip text="Do registrací se nezapisuje" className={styles.submit}>
          <Button type="submit" variant="primary" icon="plus" busy={submitting}>
            {submitting ? 'Přidávám…' : 'Přidat do závodu'}
          </Button>
        </Tooltip>
      </div>
    </form>
  );
}
