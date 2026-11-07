import { Button, Field, Input, Select } from '../../../ms/index.js';
import { clubLabel } from '../registrations.js';
import styles from './RegistrationFilters.module.css';

/**
 * Hledání, filtr klubu a kategorie a řazení přihlášek; při aktivním filtru řádek
 * „Zobrazeno X z Y“ s tlačítkem Zrušit filtr (AdminPrihlasky).
 */
export default function RegistrationFilters({
  filter,
  onFilterChange,
  sort,
  onSortChange,
  clubs,
  categories,
  shown,
  total,
  filtered,
  onReset,
}) {
  const set = (key) => (event) => onFilterChange({ ...filter, [key]: event.target.value });

  return (
    <section aria-label="Filtr přihlášek" className={styles.filters}>
      <div className={styles.controls}>
        <Field label="Hledat závodníka" className={styles.search}>
          <Input
            size="sm"
            type="search"
            placeholder="Příjmení nebo jméno"
            value={filter.query}
            onChange={set('query')}
          />
        </Field>
        <Field label="Klub" className={styles.select}>
          <Select size="sm" value={filter.club} onChange={set('club')}>
            <option value="">Všechny kluby</option>
            {clubs.map((club) => (
              <option key={club} value={club}>
                {clubLabel(club)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kategorie" className={styles.select}>
          <Select size="sm" value={filter.category} onChange={set('category')}>
            <option value="">Všechny kategorie</option>
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Řazení" className={styles.select}>
          <Select size="sm" value={sort} onChange={(event) => onSortChange(event.target.value)}>
            <option value="club">Podle klubu</option>
            <option value="name">Podle příjmení</option>
          </Select>
        </Field>
      </div>
      {filtered && (
        <p className={styles.result} aria-live="polite">
          <span>
            Zobrazeno <strong>{shown}</strong> z <strong>{total}</strong>
          </span>
          <Button size="sm" variant="quiet" icon="close" onClick={onReset}>
            Zrušit filtr
          </Button>
        </p>
      )}
    </section>
  );
}
