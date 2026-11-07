import { Button, Checkbox, Field, Input, Select } from '../../../ms/index.js';
import { clubsWord, PLATNOST } from '../clubs.js';
import styles from './ClubFilters.module.css';

/** Hledání, platnost a „jen pořadatelé“ nad seznamem klubů (AdminKluby). */
export default function ClubFilters({ cm, counts }) {
  return (
    <div className={styles.filters}>
      <Field label="Hledat klub" className={styles.search}>
        <Input
          type="search"
          size="sm"
          placeholder="Hledat klub…"
          value={cm.query}
          onChange={(e) => cm.setQuery(e.target.value)}
        />
      </Field>
      <Field label="Platnost klubu" className={styles.validity}>
        <Select size="sm" value={cm.platnost} onChange={(e) => cm.setPlatnost(e.target.value)}>
          <option value={PLATNOST.vse}>Všechny kluby ({counts.total})</option>
          <option value={PLATNOST.platne}>Jen platné ({counts.total - counts.invalid})</option>
          <option value={PLATNOST.neplatne}>Jen neplatné ({counts.invalid})</option>
        </Select>
      </Field>
      <Checkbox
        label="Jen pořadatelé závodů"
        checked={cm.onlyOrganizers}
        onChange={(e) => cm.setOnlyOrganizers(e.target.checked)}
      />
      <p className={styles.summary} aria-live="polite">
        Zobrazeno {cm.visibleClubs.length} z {counts.total} {clubsWord(counts.total)}
      </p>
      {cm.filtersActive && (
        <Button size="sm" onClick={cm.resetFilters}>
          Zrušit filtry
        </Button>
      )}
    </div>
  );
}
