import { Button, Field, Icon, Input, Select } from '../../../../ms/index.js';
import { FALLBACK_DISCIPLINES, formatSlcrDate } from '../slcr.js';
import styles from './SlcrEventForm.module.css';

const eventLabel = (ev) => `${formatSlcrDate(ev.date)} – ${ev.name}${ev.place ? `, ${ev.place}` : ''} (#${ev.id})`;

/** Stav seznamu akcí, když z něj nejde vybírat. */
function EventsNote({ status, events, eventsError }) {
  if (eventsError) return <p className={styles.note}>{`Akce se nepodařilo načíst: ${eventsError}`}</p>;
  if (events && events.length === 0) return <p className={styles.note}>Kolem data závodu v evidenci žádná akce není.</p>;
  if (status && !status.token) return <p className={styles.note}>Seznam akcí se načte, až bude na serveru token časomíry.</p>;
  return <p className={styles.note}>Načítám akce…</p>;
}

/**
 * Krok 1: akce v evidenci (výběr z akcí ±3 dny od závodu nebo číslo z adresy
 * v evidenci), disciplína a náhled. Po náhledu pod formulářem karta akce
 * s odkazem do evidence.
 */
export default function SlcrEventForm({ slcr, primary }) {
  const { events, eventId, plan, configured, busy } = slcr;
  const disabled = !configured || Boolean(busy);
  const listed = events?.some((ev) => String(ev.id) === eventId);
  const event = plan?.event;

  return (
    <div className={styles.form}>
      {events?.length > 0 ? (
        <Field label="Akce v evidenci">
          <Select size="sm" value={listed ? eventId : ''} disabled={disabled} onChange={(e) => slcr.setEventId(e.target.value)}>
            <option value="">Vyberte akci…</option>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{eventLabel(ev)}</option>)}
          </Select>
        </Field>
      ) : (
        <div className={styles.listNote}>
          <span className={styles.label}>Akce v evidenci</span>
          <EventsNote status={slcr.status} events={events} eventsError={slcr.eventsError} />
        </div>
      )}
      <div className={styles.pair}>
        <Field label="Číslo akce" hint="Z adresy akce v evidenci">
          <Input
            size="sm"
            mono
            inputMode="numeric"
            autoComplete="off"
            value={eventId}
            disabled={disabled}
            onChange={(e) => slcr.setEventId(e.target.value)}
          />
        </Field>
        <Field label="Disciplína">
          <Select size="sm" value={slcr.discipline} disabled={disabled} onChange={(e) => slcr.setDiscipline(e.target.value)}>
            {(slcr.disciplines || FALLBACK_DISCIPLINES).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Button
        size="sm"
        variant={primary ? 'primary' : 'outline'}
        icon="search"
        busy={busy === 'plan'}
        disabled={!slcr.canPreview}
        onClick={slcr.loadPlan}
      >
        {plan ? 'Načíst náhled znovu' : 'Načíst náhled'}
      </Button>
      {event && (
        <div className={styles.event}>
          <strong className={styles.eventName}>{event.name}</strong>
          <span className={styles.eventMeta}>
            {[event.place, formatSlcrDate(event.date), `#${event.id}`].filter(Boolean).join(' · ')}
          </span>
          {event.url && (
            <a className={styles.link} href={event.url} target="_blank" rel="noreferrer">
              Otevřít v evidenci
              <Icon name="external-link" size={16} />
              <span className="ms-sr-only"> (otevře se v novém okně)</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
