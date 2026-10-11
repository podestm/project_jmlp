import { Link } from 'react-router-dom';
import { Badge, BibDate, ButtonLink, Container, Icon } from '../../ms/index.js';
import { raceMethod, raceEyebrow, raceOrganizer, raceTitle } from './raceDetail.js';
import styles from './RaceHero.module.css';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const STATUS = {
  open: { tone: 'open', icon: 'check', label: 'Přihlášky otevřeny' },
  closed: { tone: 'neutral', icon: 'lock', label: 'Registrace uzavřena' },
  past: { tone: 'neutral', icon: 'flag', label: 'Závod proběhl' },
};

/** Dokument závodu ke stažení, nebo přerušovaný zástupce, proč tu ještě není. */
function DocumentButton({ href, label, missing, missingIcon, primary = false }) {
  if (!href) {
    return <span className={styles.missing}><Icon name={missingIcon} size={18} />{missing}</span>;
  }
  return (
    <ButtonLink href={href} target="_blank" rel="noopener noreferrer" variant={primary ? 'inverse' : 'on-dark'} icon="download" block>
      {label}
    </ButtonLink>
  );
}

/**
 * Navy hlavička detailu závodu (ZavodDetail*, MobilZavodDetail*): zpět do
 * kalendáře, datum jako startovní číslo, číslo a pořadí závodu, název,
 * typ a pořadatel; vpravo stav přihlášek a dokumenty závodu.
 */
export default function RaceHero({ race, state }) {
  const method = raceMethod(race);
  const organizer = raceOrganizer(race);
  const status = STATUS[state];
  const results = race.results_file_id && `${API_BASE}/races/${race.id}/results`;
  const proposition = race.proposition_file_id && `${API_BASE}/races/${race.id}/proposition`;

  return (
    <div className={styles.hero}>
      <Container className={styles.inner}>
        <Link to="/zavody" className={styles.back}>
          <Icon name="arrow-left" size={16} />
          Zpět na kalendář závodů
        </Link>
        <div className={styles.main}>
          <BibDate date={race.datum} variant="card" className={styles.bib} />
          <div className={styles.text}>
            <p className={styles.eyebrow}>{raceEyebrow(race)}</p>
            <h1 className={styles.title}>{raceTitle(race)}</h1>
            <ul className={styles.meta}>
              <li><Icon name={method.icon} size={16} />{method.key === 'snow' ? 'Závod na sněhu' : 'Suchý závod'}</li>
              {organizer && <li><Icon name="building" size={16} />Pořádá {organizer}</li>}
            </ul>
          </div>
          <div className={styles.aside}>
            <Badge tone={status.tone} icon={status.icon} className={styles.status}>{status.label}</Badge>
            {state === 'past' ? (
              <>
                <DocumentButton href={results} primary label="Výsledky závodu (PDF)" missing="Výsledky se připravují" missingIcon="clock" />
                {proposition && <DocumentButton href={proposition} label="Propozice (PDF)" />}
              </>
            ) : (
              <>
                <DocumentButton href={proposition} label="Propozice (PDF)" missing="Propozice zatím nejsou" missingIcon="file" />
                <DocumentButton href={results} label="Výsledky závodu (PDF)" missing="Výsledky až po závodě" missingIcon="trophy" />
              </>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
