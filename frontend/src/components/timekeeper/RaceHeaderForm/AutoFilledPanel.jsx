import { Alert, Icon } from '../../ms/index.js';
import { formatDateShort } from '../../../utils/date.js';
import styles from './AutoFilledPanel.module.css';

/**
 * „Z databáze se doplní automaticky“ (TkHlavickaZavodu, pravý sloupec):
 * co se do hlavičky vezme samo, a stav loga pořadatele.
 */
export default function AutoFilledPanel({ detail }) {
  const rows = [
    ['Závod', detail.areal_name],
    ['Datum', detail.datum ? formatDateShort(detail.datum) : null],
    ['Číslo závodu', detail.race_number_label],
    ['Pořádající klub', detail.organizer_name],
    ['Ročník poháru', detail.edition_label ? `${detail.edition_label} ročník` : null],
  ];

  return (
    <aside className={styles.aside}>
      <section className={styles.panel} aria-labelledby="z-databaze">
        <h2 id="z-databaze" className={styles.head}>
          <Icon name="database" size={20} />
          Z databáze se doplní automaticky
        </h2>
        <dl className={styles.list}>
          {rows.map(([label, value]) => (
            <div key={label} className={styles.row}>
              <dt>{label}</dt>
              <dd>{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </section>

      {detail.organizer_logo_url ? (
        <Alert type="info" compact title="Logo pořadatele je nahrané" />
      ) : (
        <Alert type="warning" compact title="Pořádající klub nemá nahrané logo">
          Levé místo v hlavičce listiny zůstane prázdné.
        </Alert>
      )}
    </aside>
  );
}
