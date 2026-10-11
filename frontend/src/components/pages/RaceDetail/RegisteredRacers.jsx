import { useState } from 'react';
import { Alert, Badge, Button, LoadingState, Paska } from '../../ms/index.js';
import { fixEncoding } from '../../../utils/text.js';
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

/**
 * Přihlášení závodníci rozdělení podle klubů (ZavodDetail vpravo,
 * MobilRegistrace dole): jméno, ročník, SLČR ID a kategorie. Rozlišuje
 * načítání, chybu se Zkusit znovu a prázdný seznam.
 */
export default function RegisteredRacers({ registrations, status, onRetry }) {
  const [expanded, setExpanded] = useState(false);
  const total = registrations?.total_racers ?? 0;
  const clubs = registrations?.clubs ?? [];
  const shown = takeRows(clubs, expanded ? Infinity : PREVIEW);

  let content;
  if (status === 'loading') {
    content = <LoadingState variant="inline" label="Načítám přihlášené…" />;
  } else if (status === 'error') {
    content = (
      <Alert type="danger" title="Seznam přihlášených se nepodařilo načíst." compact
        actions={<Button size="sm" icon="refresh" onClick={onRetry}>Zkusit znovu</Button>}>
        Zbytek stránky funguje dál.
      </Alert>
    );
  } else if (total === 0) {
    content = <p className={styles.empty}>Zatím není nikdo přihlášen. Buďte první.</p>;
  } else {
    content = (
      <div className={styles.panel}>
        {shown.map((club) => (
          <section key={club.club_name} aria-label={`${fixEncoding(club.club_name)}, přihlášeno ${club.total}`}>
            <h3 className={styles.clubName}>
              {fixEncoding(club.club_name)}
              <span className={styles.clubCount}>{club.total}</span>
            </h3>
            <ul className={styles.racers}>
              {club.racers.map((racer) => (
                <li key={`${racer.lastName}-${racer.firstName}-${racer.birthYear}`} className={styles.racer}>
                  <span className={styles.racerText}>
                    <span className={styles.racerName}>{racer.lastName} {racer.firstName}</span>
                    <span className={styles.racerMeta}>
                      {[racer.birthYear, racer.idSlcr ? `SLČR ${racer.idSlcr}` : 'bez SLČR ID'].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {racer.category_name && <Badge tone="neutral" size="sm">{racer.category_name}</Badge>}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {total > PREVIEW && (
          <button type="button" className={styles.more} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Zobrazit méně' : `Zobrazit všech ${total} závodníků`}
          </button>
        )}
      </div>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="prihlaseni">
      <Paska id="prihlaseni" aside={status === 'ready' && <span className={styles.total}>{total}</span>}>Přihlášení závodníci</Paska>
      {content}
    </section>
  );
}
