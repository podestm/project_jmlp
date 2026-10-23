import { Field, Input } from '../../ms/index.js';
import styles from './RunPanel.module.css';

/** Pole jednoho kola: popisek, typ a nápověda (TkHlavickaZavodu). */
const FIELDS = [
  { key: 'course_setter', label: 'Stavitel trati', hint: 'Tiskne se v hlavičce.', size: 'wide' },
  { key: 'gates_count', label: 'Počet branek', hint: 'Celé číslo.', number: true },
  { key: 'start_time', label: 'Čas startu', hint: 'Volný text.', placeholder: '10:00' },
  {
    key: 'course_length_m',
    label: 'Délka trati',
    hint: 'Samotné číslo v metrech, jinak volný text.',
    placeholder: 'např. 400 nebo 400m, 7 stanovišť',
    title: 'Samotné číslo se vytiskne v metrech (400 → 400m), jinak se text vytiskne, jak je',
    maxLength: 60,
  },
  { key: 'conditions', label: 'Podmínky', hint: 'Povrch, počasí, teplota.', placeholder: 'např. zataženo', size: 'grow' },
];

/**
 * Parametry jednoho kola: záhlaví s číslem kola a pět polí v řadě.
 * Nevyplněné kolo se do hlavičky listiny netiskne.
 */
export default function RunPanel({ run, onChange }) {
  const n = run.run_number;
  return (
    <section className={styles.panel} aria-labelledby={`kolo-${n}`}>
      <header className={styles.head}>
        <span className={styles.number} aria-hidden="true">{n}</span>
        <h3 id={`kolo-${n}`} className={styles.title}>Kolo {n}</h3>
        <span className={styles.note}>Nevyplněné kolo se do hlavičky netiskne</span>
      </header>
      <div className={styles.fields}>
        {FIELDS.map((field) => (
          <Field key={field.key} label={field.label} hint={field.hint} id={`kolo-${n}-${field.key}`} className={styles[field.size]}>
            <Input
              type={field.number ? 'number' : 'text'}
              min={field.number ? '0' : undefined}
              mono={field.number}
              placeholder={field.placeholder}
              title={field.title}
              maxLength={field.maxLength}
              value={run[field.key]}
              onChange={(e) => onChange(n, field.key, e.target.value)}
            />
          </Field>
        ))}
      </div>
    </section>
  );
}
