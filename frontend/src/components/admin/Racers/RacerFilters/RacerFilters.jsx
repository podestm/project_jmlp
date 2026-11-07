import { Button, Combobox, Field, Input, Select } from '../../../ms/index.js';
import { formatCount } from '../racers.js';
import styles from './RacerFilters.module.css';

/**
 * Hledání, kategorie, klub a pohlaví nad seznamem závodníků (AdminZavodnici,
 * AdminDialogVyberKlubu: klub i kategorie jsou výběr s hledáním). Vpravo
 * „Zobrazeno X z Y“, při aktivním filtru s tlačítkem Zrušit filtry.
 */
export default function RacerFilters({
  searchInput, onSearchChange, filter, onFilterChange, clubs, categories, shown, total, active, onReset,
}) {
  // Combobox posílá null (křížek „Zrušit výběr“), filtr drží prázdný řetězec.
  const choose = (key) => (value) => onFilterChange(key, value ?? '');

  return (
    <section aria-label="Filtr závodníků" className={styles.filters}>
      <Field label="Hledat" className={styles.search}>
        <Input
          size="sm"
          type="search"
          placeholder="Jméno, příjmení nebo číslo SLČR"
          value={searchInput}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </Field>
      <Field label="Kategorie" className={styles.category}>
        <Combobox
          size="sm"
          options={categories}
          value={filter.category || null}
          onChange={choose('category')}
          placeholder="Všechny kategorie"
          clearLabel="Zrušit výběr kategorie"
          noMatchText={(query) => `Žádná kategorie neodpovídá „${query}“.`}
        />
      </Field>
      <Field label="Klub" className={styles.club}>
        <Combobox
          size="sm"
          options={clubs}
          value={filter.club || null}
          onChange={choose('club')}
          placeholder="Všechny kluby"
          clearLabel="Zrušit výběr klubu"
          noMatchText={(query) => `Žádný klub neodpovídá „${query}“. Zkontrolujte překlep.`}
          footer={<span className={styles.count}>{clubs.length} klubů</span>}
        />
      </Field>
      <Field label="Pohlaví" className={styles.sex}>
        <Select size="sm" value={filter.sex} onChange={(event) => onFilterChange('sex', event.target.value)}>
          <option value="">Všichni</option>
          <option value="1">Muži</option>
          <option value="2">Ženy</option>
        </Select>
      </Field>
      <p className={styles.summary} aria-live="polite">
        <span>Zobrazeno <strong>{formatCount(shown)}</strong> z <strong>{formatCount(total)}</strong></span>
        {active && <Button size="sm" variant="quiet" icon="close" onClick={onReset}>Zrušit filtry</Button>}
      </p>
    </section>
  );
}
