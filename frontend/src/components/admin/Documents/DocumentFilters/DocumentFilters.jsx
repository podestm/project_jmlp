import { Button, Field, Input, Select } from '../../../ms/index.js';
import { OWNER_FILTERS } from '../../../../config/libraryApi.js';
import styles from './DocumentFilters.module.css';

/** Filtry knihovny a souhrn „Zobrazeno 6 z 96 souborů“ (AdminDokumenty). */
export default function DocumentFilters({ filters, setFilter, extensions, shown, total, active, onReset }) {
  return (
    <div className={styles.filters}>
      <Field label="Název souboru" className={styles.search}>
        <Input
          type="search"
          size="sm"
          placeholder="Hledat v názvech…"
          value={filters.q}
          onChange={(e) => setFilter('q', e.target.value)}
        />
      </Field>
      <Field label="Přípona" className={styles.extension}>
        <Select size="sm" value={filters.extension} onChange={(e) => setFilter('extension', e.target.value)}>
          <option value="">Všechny</option>
          {extensions.map((ext) => <option key={ext} value={ext}>{ext.toUpperCase()}</option>)}
        </Select>
      </Field>
      <Field label="Použito" className={styles.owner}>
        <Select size="sm" value={filters.owner_type} onChange={(e) => setFilter('owner_type', e.target.value)}>
          {OWNER_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </Field>
      <Field label="Nahráno od" className={styles.date}>
        <Input type="date" size="sm" value={filters.date_from} onChange={(e) => setFilter('date_from', e.target.value)} />
      </Field>
      <Field label="Nahráno do" className={styles.date}>
        <Input type="date" size="sm" value={filters.date_to} onChange={(e) => setFilter('date_to', e.target.value)} />
      </Field>
      {active && <Button size="sm" onClick={onReset} className={styles.reset}>Zrušit filtry</Button>}
      <p className={styles.summary} aria-live="polite">
        <span className={styles.count}>
          Zobrazeno <strong>{shown}</strong> z <strong>{total}</strong> souborů
        </span>
      </p>
    </div>
  );
}
