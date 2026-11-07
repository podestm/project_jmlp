import { Field, Select } from '../../../ms/index.js';
import { seasonOptionLabel } from '../raceList.js';
import styles from './RaceFilters.module.css';

/** Filtr sezóny a souhrn vyfiltrovaných závodů (AdminZavody, AdminMobilZavody). */
export default function RaceFilters({ seasonFilter, setSeasonFilter, availableSeasons, summary }) {
  return (
    <div className={styles.filters}>
      <Field label="Sezóna" className={styles.season}>
        <Select size="sm" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}>
          <option value="">Všechny sezóny</option>
          {availableSeasons.map((season) => (
            <option key={season} value={season}>
              {seasonOptionLabel(season)}
            </option>
          ))}
        </Select>
      </Field>
      <p className={styles.summary} aria-live="polite">
        {summary}
      </p>
    </div>
  );
}
