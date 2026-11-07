import { Field, Input } from '../../ms/index.js';
import styles from './RunPanel.module.css';

/** Pole jednoho kola: popisek, typ a formát (TkHlavickaZavodu). */
const FIELDS = [
  { key: 'course_setter', label: 'Stavitel trati', size: 'wide' },
  { key: 'gates_count', label: 'Počet branek', number: true },
  { key: 'start_time', label: 'Čas startu', placeholder: '10:00' },
  {
    key: 'course_length_m',
    label: 'Délka trati',
    hint: 'Číslo = metry',
    placeholder: 'např. 400 nebo 400m, 7 stanovišť',
    maxLength: 60,
  },
  { key: 'conditions', label: 'Podmínky', placeholder: 'např. zataženo', size: 'grow' },
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
        <span className={styles.number} aria-hidden="true">
          {n}
        </span>
        <h3 id={`kolo-${n}`} className={styles.title}>
          Kolo {n}
        </h3>
      </header>
      <div className={styles.fields}>
        {FIELDS.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            hint={field.hint}
            id={`kolo-${n}-${field.key}`}
            className={styles[field.size]}
          >
            <Input
              type={field.number ? 'number' : 'text'}
              min={field.number ? '0' : undefined}
              mono={field.number}
              placeholder={field.placeholder}
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
