import { Alert, Badge, Button, Panel } from '../../../../ms/index.js';
import { DRY_RUN_TEXT, categoryState, missingCount, racersText } from '../slcr.js';
import styles from './SlcrCategoryPanel.module.css';

/** Co panel řekne pod stavem a jestli jde odeslat – slovy, ne jen vypnutým tlačítkem. */
const panelNote = ({ slcr, item, missing, isOnline }) => {
  if (!isOnline) return { text: 'Odeslání do SLČR vyžaduje připojení.' };
  if (slcr.loading && !item) return { text: 'Načítám stav v evidenci SLČR…' };
  if (slcr.error) return { text: slcr.error, retry: true };
  if (!item) return { text: 'Stav kategorie v evidenci se nepodařilo zjistit.', retry: true };
  if (!item.slcr_race_id)
    return {
      text: 'Kategorie nemá v akci svůj závod – založte ho v Evidenci SLČR (krok 2).',
      openEvidence: true,
    };
  if (missing > 0)
    return { text: `${racersText(missing)} bez času – nejdřív zapište čas nebo DNF/DNS/DSQ.` };
  return { text: 'Všichni mají čas nebo DNF/DNS/DSQ.', ready: true };
};

/**
 * Evidence SLČR u vybrané kategorie ve Výsledcích: stav v akci slovy,
 * připravenost (kdo ještě nemá čas) a jedno tlačítko „Odeslat a zveřejnit“
 * (u zveřejněné „Opravit v SLČR“) za potvrzením. Akce je ta, kterou časoměřič
 * ráno vybral v dialogu Evidence SLČR; bez ní panel pošle tam.
 */
export default function SlcrCategoryPanel({ category, slcr, isOnline, onOpenEvidence }) {
  const id = String(category.category_id);
  const headingId = `slcr-kategorie-${id}`;
  const title = (
    <h3 id={headingId} className={styles.title}>
      Evidence SLČR
    </h3>
  );

  if (!slcr.eventId) {
    return (
      <Panel as="section" aria-labelledby={headingId} className={styles.panel}>
        <div className={styles.row}>
          <div className={styles.info}>
            {title}
            <p className={styles.note}>Akce zatím není vybraná.</p>
          </div>
          <Button size="sm" icon="cloud-upload" disabled={!isOnline} onClick={onOpenEvidence}>
            Evidence SLČR
          </Button>
        </div>
      </Panel>
    );
  }

  const item = slcr.find(id);
  const missing = missingCount(category.entries);
  const state = categoryState(item);
  const note = panelNote({ slcr, item, missing, isOnline });
  const correction = state.key === 'Published';
  const busy = slcr.busyId === id;
  const message = slcr.message?.categoryId === id ? slcr.message : null;

  return (
    <Panel as="section" aria-labelledby={headingId} className={styles.panel}>
      <div className={styles.row}>
        <div className={styles.info}>
          <div className={styles.head}>
            {title}
            {item && (
              <Badge size="sm" tone={state.tone}>
                {state.label}
              </Badge>
            )}
          </div>
          <p className={styles.note}>
            {note.text}
            {slcr.event?.name && (
              <span className={styles.event}>{` Akce: ${slcr.event.name}`}</span>
            )}
          </p>
        </div>
        {note.retry && (
          <Button
            size="sm"
            icon="refresh"
            disabled={!isOnline || slcr.loading}
            onClick={slcr.reload}
          >
            Načíst znovu
          </Button>
        )}
        {note.openEvidence && (
          <Button size="sm" icon="cloud-upload" onClick={onOpenEvidence}>
            Evidence SLČR
          </Button>
        )}
        {!note.retry && !note.openEvidence && (
          <Button
            size="sm"
            variant={correction ? 'outline' : 'primary'}
            icon={correction ? 'pencil' : 'publish'}
            busy={busy}
            disabled={!note.ready || Boolean(slcr.busyId)}
            onClick={() => slcr.publish(id, category.category_name)}
          >
            {correction ? 'Opravit v SLČR' : 'Odeslat a zveřejnit v SLČR'}
          </Button>
        )}
      </div>
      {slcr.dryRun && <p className={styles.dryRun}>{DRY_RUN_TEXT}</p>}
      {message && (
        <Alert type={message.type} compact autoDismissDelay={0} onDismiss={slcr.clearMessage}>
          {message.text}
        </Alert>
      )}
    </Panel>
  );
}
