import { useMemo, useState } from 'react';
import {
  Button,
  ButtonLink,
  Container,
  Field,
  Input,
  PageHeader,
  Paska,
  Screen,
} from '../../ms/index.js';
import { normalizeForSearch } from '../../../utils/text.js';
import { czechPlural } from '../../../utils/races.js';
import { CLUBS, OFFICIALS, ORGANIZER } from './contacts.js';
import { usePageMeta } from '../../../hooks/usePageMeta.js';
import { useScrollToHash } from '../../../hooks/useScrollToHash.js';
import { PAGE_META } from '../../../seo/pageMeta.js';
import styles from './Contacts.module.css';

// Kolik klubů je vidět bez hledání před „Zobrazit všech N klubů“.
const CLUBS_PREVIEW = 9;
const SORTED_CLUBS = [...CLUBS].sort((a, b) => a.name.localeCompare(b.name, 'cs'));

/** Kontakty /kontakty (Kontakty.dc.html, MobilKontakty.dc.html). */
export default function Contacts() {
  usePageMeta(PAGE_META.contacts);
  useScrollToHash();
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const matching = useMemo(() => {
    const needle = normalizeForSearch(query);
    return needle
      ? SORTED_CLUBS.filter((club) => normalizeForSearch(club.name).includes(needle))
      : SORTED_CLUBS;
  }, [query]);
  const shown = query || showAll ? matching : matching.slice(0, CLUBS_PREVIEW);

  return (
    <Screen>
      <Container className={styles.page}>
        <PageHeader eyebrow="Pořadatel, výbor a kluby" title="Kontakty" />

        <section className={styles.section} aria-labelledby="poradatel">
          <Paska id="poradatel">Pořadatel poháru</Paska>
          <div className={styles.organizer}>
            <h3 className={styles.name}>{ORGANIZER.name}</h3>
            <p className={styles.address}>
              {ORGANIZER.street}, {ORGANIZER.city} · IČO {ORGANIZER.ico}
            </p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="vybor">
          <Paska id="vybor">Soutěžní výbor</Paska>
          <ul className={styles.officials}>
            {OFFICIALS.map((official, index) => (
              <li
                key={official.email}
                className={styles.official}
                data-lead={index === 0 || undefined}
              >
                <p className={styles.position}>{official.position}</p>
                <h3 className={styles.name}>{official.name}</h3>
                <p className={styles.email}>{official.email}</p>
                <ButtonLink
                  href={`mailto:${official.email}`}
                  variant="outline"
                  icon="mail"
                  block
                  aria-label={`Napsat e-mail – ${official.name}`}
                >
                  Napsat e-mail
                </ButtonLink>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="kluby">
          <div className={styles.clubsHead}>
            <div className={styles.clubsTitle}>
              <Paska id="kluby">Kluby v poháru</Paska>
              <p className={styles.note}>{CLUBS.length} klubů</p>
            </div>
            <Field label="Najít klub" className={styles.search}>
              <Input
                type="search"
                placeholder="Název klubu nebo město"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </Field>
          </div>
          {matching.length === 0 ? (
            <p className={styles.noMatch} role="status">
              Žádný klub neobsahuje „{query}“.
            </p>
          ) : (
            <ul className={styles.clubs}>
              {shown.map((club) => (
                <li key={club.name} className={styles.club}>
                  <span className={styles.clubText}>
                    <span className={styles.clubName}>{club.name}</span>
                    <span className={styles.email}>{club.email}</span>
                  </span>
                  <ButtonLink
                    href={`mailto:${club.email}`}
                    size="sm"
                    icon="mail"
                    className={styles.mail}
                    aria-label={`Napsat e-mail – ${club.name}`}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className={styles.footer}>
            {!query && matching.length > CLUBS_PREVIEW && (
              <Button aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
                {showAll
                  ? 'Zobrazit méně'
                  : `Zobrazit všech ${CLUBS.length} ${czechPlural(CLUBS.length, ['klub', 'kluby', 'klubů'])}`}
              </Button>
            )}
            <p className={styles.note}>Chybí váš klub? Napište nám a doplníme ho.</p>
          </div>
        </section>
      </Container>
    </Screen>
  );
}
