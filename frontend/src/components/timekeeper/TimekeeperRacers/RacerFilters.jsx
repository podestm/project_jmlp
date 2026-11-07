import { Field, Input, Select } from '../../ms/index.js';
import styles from './RacerFilters.module.css';

/** Filtry tabulky závodníků (TkZavodnici): text, oddíl, kategorie, pohlaví a počet. */
export default function RacerFilters({ filters, setFilter, clubOptions, categoryOptions, shown, total }) {
  return (
    <div className={styles.bar} role="search" aria-label="Filtr závodníků">
      <Field label="Hledat" id="tk-filter-text" className={styles.text}>
        <Input
          size="sm"
          type="search"
          placeholder="Jméno nebo číslo"
          value={filters.text}
          onChange={(e) => setFilter('text', e.target.value)}
        />
      </Field>
      <Field label="Oddíl" id="tk-filter-club">
        <Select size="sm" value={filters.club} onChange={(e) => setFilter('club', e.target.value)}>
          <option value="all">Všechny oddíly</option>
          {clubOptions.map((club) => <option key={club} value={club}>{club}</option>)}
        </Select>
      </Field>
      <Field label="Kategorie" id="tk-filter-category">
        <Select size="sm" value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="all">Všechny kategorie</option>
          {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
        </Select>
      </Field>
      <Field label="Pohlaví" id="tk-filter-sex">
        <Select size="sm" value={filters.sex} onChange={(e) => setFilter('sex', e.target.value)}>
          <option value="all">Všechna pohlaví</option>
          <option value="1">Muži</option>
          <option value="2">Ženy</option>
        </Select>
      </Field>
      <p className={styles.count} aria-live="polite">
        <span className={styles.number}>{shown}</span> z <span className={styles.number}>{total}</span>
      </p>
    </div>
  );
}
