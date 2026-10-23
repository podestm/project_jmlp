import { Button, Combobox, Field, Input, SegmentedControl } from '../../../ms/index.js';
import { canResolve, formatRequestDate } from '../clubRequests.js';
import styles from './RequestCard.module.css';

const MODES = [
  { value: 'existing', label: 'Přiřadit existující klub' },
  { value: 'new', label: 'Vytvořit nový klub' },
];

/**
 * Jedna žádost (AdminZadosti, AdminMobilZadosti): závodník, závod, co napsal
 * ručně, a rozhodnutí – existující klub z hledání, nebo nový klub
 * předvyplněný tím, co závodník napsal.
 */
export default function RequestCard({ request, clubOptions, state, onChange, onResolve }) {
  const id = request.registration_id;
  const setMode = (mode) => onChange(id, mode === 'new' ? { mode, newName: state.newName || request.club_request_note } : { mode });

  return (
    <article className={styles.card} aria-label={`Žádost ${request.racer_name}`}>
      <div className={styles.who}>
        <h2 className={styles.name}>{request.racer_name}</h2>
        <span className={styles.meta}>{request.race_name} · {formatRequestDate(request.registered_at)}</span>
        {request.current_club_name && (
          <span className={styles.meta}>Aktuální klub: {request.current_club_name}</span>
        )}
      </div>
      <div className={styles.note}>
        <span className={styles.noteLabel}>Napsal(a) ručně</span>
        <span className={styles.noteValue}>„{request.club_request_note}“</span>
      </div>
      <div className={styles.decision}>
        <SegmentedControl label="Způsob vyřízení" size="sm" options={MODES} value={state.mode} onChange={setMode} />
        <div className={styles.row}>
          {state.mode === 'existing' ? (
            <Field label="Přiřadit ke klubu" className={styles.field}>
              <Combobox
                size="sm"
                options={clubOptions}
                value={state.clubId}
                onChange={(clubId) => onChange(id, { clubId })}
                placeholder="Hledat klub…"
                noMatchText={(query) => `Klub „${query}“ v seznamu není – založte nový.`}
              />
            </Field>
          ) : (
            <Field label="Název nového klubu" hint="Předvyplněno tím, co závodník napsal při registraci." className={styles.field}>
              <Input size="sm" value={state.newName} onChange={(e) => onChange(id, { newName: e.target.value })} placeholder="Název klubu…" />
            </Field>
          )}
          <Button variant="open" size="sm" icon="check" disabled={!canResolve(state)} onClick={() => onResolve(id)} className={styles.confirm}>
            Potvrdit a přiřadit
          </Button>
        </div>
      </div>
    </article>
  );
}
