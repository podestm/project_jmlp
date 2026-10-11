import { Alert, Badge, Button, IconButton } from '../../../ms/index.js';
import StatBox from '../StatBox/StatBox.jsx';
import styles from './CoverageReport.module.css';

const gapText = (gap) => (gap.start === gap.end ? `Ročník ${gap.start}` : `Ročníky ${gap.start}–${gap.end} (${gap.count} let)`);
const isClean = (sexData) => !sexData.gap_ranges?.length && !sexData.overlap_details?.length;

/** Výsledek jednoho pohlaví: počty, nepokryté rozsahy, první tři překryvy. */
function SexResult({ sexName, sexData }) {
  const gaps = sexData.gap_ranges || [];
  const overlaps = sexData.overlap_details || [];
  return (
    <section className={styles.sex} data-clean={isClean(sexData) || undefined} aria-label={sexName}>
      <div className={styles.sexHead}>
        <h4 className={styles.sexName}>{sexName}</h4>
        <Badge size="sm" tone={gaps.length ? 'dry' : 'open'}>{gaps.length} nepokrytých rozmezí</Badge>
        <Badge size="sm" tone={overlaps.length ? 'dry' : 'open'}>{overlaps.length} překryvů</Badge>
      </div>
      {gaps.length > 0 && (
        <ul className={styles.list} aria-label="Nepokryté rozsahy">
          {gaps.map((gap, idx) => <li key={idx}>Nepokryto: {gapText(gap)}</li>)}
        </ul>
      )}
      {overlaps.length > 0 && (
        <ul className={styles.list} aria-label="Překryvy">
          {overlaps.slice(0, 3).map((overlap, idx) => <li key={idx}>Překryv: ročník {overlap.year}</li>)}
          {overlaps.length > 3 && <li>… a {overlaps.length - 3} dalších</li>}
        </ul>
      )}
      {isClean(sexData) && <p className={styles.ok}>Všechny ročníky OK</p>}
    </section>
  );
}

/** Podrobnosti po pohlavích: celé hlášky backendu. */
function Details({ bySex }) {
  return Object.entries(bySex).map(([sexName, sexData]) => (
    <div key={sexName} className={styles.details}>
      <h4 className={styles.detailsTitle}>Detaily pro {sexName}</h4>
      {sexData.gap_ranges?.length > 0 && (
        <ul className={styles.list} aria-label={`Nepokryté rozsahy ${sexName}`}>
          {sexData.gap_ranges.map((gap, idx) => <li key={idx}>{gap.message}</li>)}
        </ul>
      )}
      {sexData.overlap_details?.length > 0 && (
        <ul className={styles.list} aria-label={`Překrývající se ročníky ${sexName}`}>
          {sexData.overlap_details.map((overlap, idx) => <li key={idx}>{overlap.message}</li>)}
        </ul>
      )}
    </div>
  ));
}

/**
 * Report kontroly pokrytí ročníků kategoriemi (AdminDialogPokrytiKategorii –
 * karta na stránce, endpoint /categories/check/coverage).
 *
 * Všechna pole z API se čtou přes `?.` - starší backend vracel plochý tvar
 * (gap_ranges / overlaps) a inactive_categories nemusí dorazit vůbec.
 */
export default function CoverageReport({ report, showDetails, onToggleDetails, onClose }) {
  const bySex = report.results_by_sex;
  const ok = report.status === 'ok';
  const gapCount = bySex
    ? Object.values(bySex).reduce((sum, sexData) => sum + (sexData.gap_ranges?.length || 0), 0)
    : (report.gap_ranges?.length || 0);
  const allClean = bySex
    ? Object.values(bySex).every(isClean)
    : !report.gap_ranges?.length && !report.overlaps?.length;

  return (
    <section className={styles.report} aria-labelledby="pokryti-nadpis">
      <header className={styles.head}>
        <Badge size="sm" tone={ok ? 'open' : 'dry'}>{ok ? 'OK' : 'Varování'}</Badge>
        <h3 id="pokryti-nadpis" className={styles.title}>Kontrola pokrytí ročníků</h3>
        <IconButton icon="close" variant="quiet" label="Zavřít výsledek kontroly" onClick={onClose} className={styles.close} />
      </header>

      <div className={styles.stats}>
        <StatBox label="Stav" value={ok ? 'OK' : 'Varování'} tone={ok ? 'open' : 'warning'} />
        <StatBox label="Rozsah" value={`${report.check_range?.min} – ${report.check_range?.max}`} note={`${report.check_range?.total_years} let`} />
        <StatBox label="Aktivních kategorií" value={report.active_categories} />
        <StatBox label="Nepokrytá rozmezí" value={gapCount} tone={gapCount ? 'warning' : 'open'} />
      </div>

      {report.racer_range && (
        <p className={styles.note}>Závodníci v databázi: ročníky {report.racer_range.min} – {report.racer_range.max}</p>
      )}
      {report.message && <p className={styles.note}>{report.message}</p>}

      {bySex && (
        <div className={styles.sexes}>
          {Object.entries(bySex).map(([sexName, sexData]) => <SexResult key={sexName} sexName={sexName} sexData={sexData} />)}
        </div>
      )}

      {bySex && (
        <div className={styles.detailsToggle}>
          <Button size="sm" icon={showDetails ? 'chevron-up' : 'chevron-down'} aria-expanded={showDetails} onClick={onToggleDetails}>
            {showDetails ? 'Skrýt detaily' : 'Zobrazit detaily'}
          </Button>
          {showDetails && <Details bySex={bySex} />}
        </div>
      )}

      {/* Starší tvar odpovědi bez results_by_sex */}
      {!bySex && report.gap_ranges?.length > 0 && (
        <Alert type="danger" compact title={`Nepokryté rozsahy (${report.gap_ranges.length})`}>
          <ul className={styles.list}>{report.gap_ranges.map((gap, idx) => <li key={idx}>{gap.message}</li>)}</ul>
        </Alert>
      )}
      {!bySex && report.overlaps?.length > 0 && (
        <Alert type="warning" compact title={`Překrývající se ročníky (${report.overlaps.length})`}>
          <ul className={styles.list}>{report.overlaps.map((overlap, idx) => <li key={idx}>{overlap.message}</li>)}</ul>
        </Alert>
      )}

      {report.inactive_categories?.length > 0 && (
        <div className={styles.inactive}>
          <h4 className={styles.detailsTitle}>Neaktivní kategorie ({report.inactive_categories.length})</h4>
          <ul className={styles.list}>
            {report.inactive_categories.map((cat, idx) => (
              <li key={idx}>
                <strong>{cat.display_name || cat.name}</strong>
                {cat.display_name && cat.name && cat.display_name !== cat.name && ` · ${cat.name}`}
                {cat.sex && ` · ${cat.sex}`} · ročníky {cat.range}
              </li>
            ))}
          </ul>
        </div>
      )}

      {allClean && (
        <Alert
          type="success"
          compact
          autoDismissDelay={0}
          title={bySex
            ? 'Všechny ročníky od roku 1900 do současnosti jsou správně pokryty kategoriemi pro obě pohlaví bez překryvů.'
            : 'Všechny ročníky od roku 1900 do současnosti jsou správně pokryty kategoriemi bez překryvů.'}
        />
      )}
    </section>
  );
}
