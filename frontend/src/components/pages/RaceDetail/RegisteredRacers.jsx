import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Cluster,
  Field,
  LoadingState,
  Paska,
  Select,
} from '../../ms/index.js';
import { fixEncoding } from '../../../utils/text.js';
import {
  EMPTY_RACER_FILTER,
  countRacers,
  filterClubs,
  isRacerFilterActive,
  racerCategoryOptions,
  racerClubOptions,
} from './registeredRacers.js';
import styles from './RegisteredRacers.module.css';

// Kolik řádků je vidět před „Zobrazit všech N“ (ZavodDetail).
const PREVIEW = 8;

/** Kluby se závodníky zkrácené na prvních `limit` řádků; `total` = počet v klubu. */
const takeRows = (clubs, limit = Infinity) => {
  let left = limit;
  return clubs
    .map((club) => {
      const racers = club.racers.slice(0, Math.max(left, 0));
      left -= racers.length;
      return { ...club, total: club.racers.length, racers };
    })
    .filter((club) => club.racers.length > 0);
};

/** Filtr klubu a kategorie nad seznamem, „Zobrazeno X z Y“ a Zrušit. */
function RacerFilters({ registrations, filter, onChange, shown, total }) {
  const clubs = useMemo(() => racerClubOptions(registrations.clubs), [registrations]);
  const categories = useMemo(() => racerCategoryOptions(registrations), [registrations]);
  const set = (key) => (event) => onChange({ ...filter, [key]: event.target.value });

  return (
    <Cluster gap={3} align="end" role="group" aria-label="Filtr přihlášených">
      <Field label="Klub" className={styles.filterField}>
        <Select value={filter.club} onChange={set('club')}>
          <option value="">Všechny kluby</option>
          {clubs.map((club) => (
            <option key={club} value={club}>
              {fixEncoding(club)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Kategorie" className={styles.filterField}>
        <Select value={filter.category} onChange={set('category')}>
          <option value="">Všechny kategorie</option>
          {categories.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Cluster gap={3} className={styles.filterResult}>
        <span aria-live="polite">
          Zobrazeno {shown} z {total}
        </span>
        {isRacerFilterActive(filter) && (
          <Button
            size="sm"
            variant="quiet"
            icon="close"
            onClick={() => onChange(EMPTY_RACER_FILTER)}
          >
            Zrušit
          </Button>
        )}
      </Cluster>
    </Cluster>
  );
}

/** Kluby se závodníky; `count` = všech odpovídajících (i skrytých za „Zobrazit všech“). */
function ClubList({ clubs, count, expanded, onToggle }) {
  return (
    <div className={styles.panel}>
      {clubs.map((club) => (
        <section
          key={club.club_name}
          aria-label={`${fixEncoding(club.club_name)}, přihlášeno ${club.total}`}
        >
          <h3 className={styles.clubName}>
            {fixEncoding(club.club_name)}
            <span className={styles.clubCount}>{club.total}</span>
          </h3>
          <ul className={styles.racers}>
            {club.racers.map((racer) => (
              <li
                key={`${racer.lastName}-${racer.firstName}-${racer.birthYear}`}
                className={styles.racer}
              >
                <span className={styles.racerText}>
                  <span className={styles.racerName}>
                    {racer.lastName} {racer.firstName}
                  </span>
                  <span className={styles.racerMeta}>
                    {[racer.birthYear, racer.idSlcr ? `SLČR ${racer.idSlcr}` : 'bez SLČR ID']
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {racer.category_name && (
                  <Badge tone="neutral" size="sm">
                    {racer.category_name}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {count > PREVIEW && (
        <button type="button" className={styles.more} aria-expanded={expanded} onClick={onToggle}>
          {expanded ? 'Zobrazit méně' : `Zobrazit všech ${count} závodníků`}
        </button>
      )}
    </div>
  );
}

/**
 * Přihlášení závodníci rozdělení podle klubů (ZavodDetail vpravo,
 * MobilRegistrace dole): jméno, ročník, SLČR ID a kategorie, filtr klubu
 * a kategorie. Rozlišuje načítání, chybu se Zkusit znovu a prázdný seznam.
 */
export default function RegisteredRacers({ registrations, status, onRetry }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState(EMPTY_RACER_FILTER);
  const total = registrations?.total_racers ?? 0;
  const filtered = useMemo(
    () => filterClubs(registrations?.clubs ?? [], filter),
    [registrations, filter],
  );
  const matching = countRacers(filtered);
  const shown = takeRows(filtered, expanded ? Infinity : PREVIEW);

  let content;
  if (status === 'loading') {
    content = <LoadingState variant="inline" label="Načítám přihlášené…" />;
  } else if (status === 'error') {
    content = (
      <Alert
        type="danger"
        title="Seznam přihlášených se nepodařilo načíst."
        compact
        actions={
          <Button size="sm" icon="refresh" onClick={onRetry}>
            Zkusit znovu
          </Button>
        }
      >
        Zbytek stránky funguje dál.
      </Alert>
    );
  } else if (total === 0) {
    content = <p className={styles.empty}>Zatím není nikdo přihlášen. Buďte první.</p>;
  } else {
    content = (
      <>
        <RacerFilters
          registrations={registrations}
          filter={filter}
          onChange={setFilter}
          shown={matching}
          total={total}
        />
        {matching === 0 ? (
          <p className={styles.empty}>Filtru nikdo neodpovídá.</p>
        ) : (
          <ClubList
            clubs={shown}
            count={matching}
            expanded={expanded}
            onToggle={() => setExpanded((value) => !value)}
          />
        )}
      </>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="prihlaseni">
      <Paska
        id="prihlaseni"
        aside={status === 'ready' && <span className={styles.total}>{total}</span>}
      >
        Přihlášení závodníci
      </Paska>
      {content}
    </section>
  );
}
