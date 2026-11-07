import { Link } from 'react-router-dom';
import { Badge, BibDate, ButtonLink, DataRow, Icon } from '../../ms/index.js';
import { fixEncoding } from '../../../utils/text.js';
import { REGISTRATION_STATE, raceMethod, raceOrder, registrationState } from '../../../utils/races.js';
import styles from './RaceRow.module.css';

const API_BASE = import.meta.env.VITE_API_BASE || '';

/** Odkaz ke stažení dokumentu závodu, nebo přerušovaný zástupce „Bez …“. */
function DocumentAction({ href, label, missingLabel }) {
  if (!href) return <span className={styles.missing}>{missingLabel}</span>;
  return (
    <ButtonLink href={href} target="_blank" rel="noopener noreferrer" size="sm" icon="download">{label}</ButtonLink>
  );
}

/**
 * Závod v kalendáři (Zavody, MobilZavody): datová karta s lištou podle stavu
 * přihlášek, datem jako startovním číslem, stavem a akcemi. Celá karta vede
 * na detail závodu (odkaz v názvu je roztažený přes kartu); dokumenty se
 * stahují přes API, které hlídá existenci souboru.
 */
export default function RaceRow({ race, today }) {
  const state = registrationState(race, today);
  const status = REGISTRATION_STATE[state];
  const method = raceMethod(race);
  const order = raceOrder(race);
  const detailPath = `/zavod/${race.id}`;
  const meta = [fixEncoding(race.organizer_name), method.label.toLowerCase(), order && `${order}. závod sezóny`]
    .filter(Boolean)
    .join(' · ');

  return (
    <DataRow
      as="li"
      variant="card"
      tone={status.bar}
      lead={<BibDate date={race.datum} variant="list" />}
      title={(
        <Link to={detailPath} className={styles.titleLink}>
          <Icon name={method.icon} size={17} className={styles.methodIcon} />
          {fixEncoding(race.areal_name)}
        </Link>
      )}
      meta={meta}
      aside={(
        <>
          <Badge tone={status.badge} icon={status.icon} className={styles.badge}>{status.label}</Badge>
          <div className={styles.actions}>
            {state === 'past' ? (
              <DocumentAction
                href={race.results_file_id && `${API_BASE}/races/${race.id}/results`}
                label="Výsledky"
                missingLabel="Zatím bez výsledků"
              />
            ) : (
              <DocumentAction
                href={race.proposition_file_id && `${API_BASE}/races/${race.id}/proposition`}
                label="Propozice"
                missingLabel="Bez propozic"
              />
            )}
            {state === 'open'
              ? <ButtonLink to={`${detailPath}#prihlaska`} variant="primary" size="sm">Registrovat</ButtonLink>
              : <ButtonLink to={detailPath} size="sm">Detail</ButtonLink>}
          </div>
        </>
      )}
    />
  );
}
