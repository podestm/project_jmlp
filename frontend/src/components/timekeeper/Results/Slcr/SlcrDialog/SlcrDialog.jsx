import { Alert, Button, EmptyState, Modal, Tooltip } from '../../../../ms/index.js';
import SlcrEventForm from '../SlcrEventForm/SlcrEventForm.jsx';
import SlcrPlanTable from '../SlcrPlanTable/SlcrPlanTable.jsx';
import SlcrStep from '../SlcrStep/SlcrStep.jsx';
import { useConfirm } from '../../../../../hooks/useConfirm.jsx';
import { DRY_RUN_TEXT, formatSlcrDate } from '../slcr.js';
import { useSlcrEvidence } from '../useSlcrEvidence.js';
import styles from './SlcrDialog.module.css';

const stepState = (done, current) => {
  if (done) return 'done';
  return current ? 'current' : 'todo';
};

/** Proč nejde odeslat výsledky – řečeno slovy, ne jen vypnutým tlačítkem. */
const sendBlocker = (slcr, hasResults) => {
  if (!hasResults) return 'Závod zatím nemá žádné výsledky.';
  if (slcr.missingRaces) return 'Nejdřív v kroku 2 založte všechny závody.';
  if (!slcr.eventId) return 'Vyberte akci v kroku 1.';
  return null;
};

const planNote = (slcr) => {
  const { summary } = slcr;
  const discipline = (slcr.disciplines || []).find((item) => item.id === Number(slcr.discipline));
  return [
    discipline && `Disciplína ${discipline.name}`,
    summary.startTime && `start ${summary.startTime}`,
    summary.toCreate && `založí se ${summary.toCreate}`,
    summary.toCodex && `kodex se doplní u ${summary.toCodex}`,
    summary.kept && `${summary.kept} už v akci je`,
    summary.skipped && `${summary.skipped} bez závodníků se nezaloží`,
  ].filter(Boolean).join(' · ');
};

/**
 * Evidence SLČR u závodu jako tři kroky v širokém dialogu: 1 akce
 * a disciplína, 2 náhled a založení závodů po kategoriích, 3 odeslání
 * výsledků. Od 1024 px jsou kroky 1 a 3 vlevo a náhled vpravo na celou výšku
 * (tabulka se posouvá ve svém rámečku), pod 1024 px jdou kroky pod sebou.
 * Hlavní (plná) je vždy jen akce aktuálního kroku; Enter nic neodesílá.
 */
export default function SlcrDialog({ race, raceId, hasResults, onClose }) {
  const { confirm, confirmElement } = useConfirm();
  const slcr = useSlcrEvidence({ raceId, hasResults, confirm });
  const { plan, summary, step, busy } = slcr;
  const blocker = sendBlocker(slcr, hasResults);

  return (
    <Modal
      open
      size="full"
      onClose={onClose}
      dismissible={!busy}
      eyebrow={['Evidence SLČR', race?.race_nr, formatSlcrDate(race?.datum)].filter(Boolean).join(' · ')}
      title="Závody a výsledky v evidenci"
      footer={<Button size="sm" data-cancel disabled={Boolean(busy)} onClick={() => onClose('button')}>Zavřít</Button>}
    >
      {slcr.dryRun && <Alert type="info" compact title={DRY_RUN_TEXT} />}
      {slcr.problems.length > 0 && (
        <Alert type="warning" compact title="SLČR není na serveru nastavené">
          {`Chybí ${slcr.problems.join(' a ')} (secret/.env na serveru).`}
        </Alert>
      )}
      {slcr.message && (
        <Alert type={slcr.message.type} compact autoDismissDelay={0} onDismiss={slcr.clearMessage}>
          {slcr.message.text}
        </Alert>
      )}

      <div className={styles.layout}>
        <SlcrStep number={1} title="Akce v evidenci" state={stepState(Boolean(plan), step === 1)} className={styles.event}>
          <SlcrEventForm slcr={slcr} primary={step === 1} />
        </SlcrStep>

        <SlcrStep number={2} title="Závody v akci" state={stepState(Boolean(plan) && !slcr.missingRaces, step === 2)} className={styles.plan}>
          {plan ? (
            <>
              <p className={styles.note}>{planNote(slcr)}</p>
              {!summary.manual && (
                <Alert type="warning" compact>
                  Akce používá kategorie z číselníku – v evidenci ji přepněte na vlastní kategorie.
                </Alert>
              )}
              <SlcrPlanTable items={plan.items} className={styles.table} />
              <div className={styles.actions}>
                <Tooltip text="Stávající závody se nezmění">
                  <Button
                    size="sm"
                    variant={step === 2 ? 'primary' : 'outline'}
                    icon="plus-circle"
                    busy={busy === 'races'}
                    disabled={!slcr.canCreate}
                    onClick={slcr.createRaces}
                  >
                    {summary.changes ? `Založit závody (${summary.changes})` : 'Založit závody'}
                  </Button>
                </Tooltip>
                {!summary.changes && <p className={styles.note}>Všechny kategorie už v akci mají svůj závod.</p>}
              </div>
            </>
          ) : (
            <EmptyState
              icon="list"
              headingLevel={4}
              title="Náhled zatím není"
            />
          )}
        </SlcrStep>

        <SlcrStep number={3} title="Výsledky" state={stepState(slcr.sent, step === 3)} className={styles.results}>
          {blocker && <p className={styles.note}>{blocker}</p>}
          <Tooltip text="V evidenci zůstanou nezveřejněné">
            <Button
              size="sm"
              variant={step === 3 && !slcr.sent ? 'primary' : 'outline'}
              icon="upload"
              busy={busy === 'results'}
              disabled={!slcr.canSend}
              onClick={slcr.sendResults}
            >
              {slcr.sent ? 'Odeslat výsledky znovu' : 'Odeslat výsledky'}
            </Button>
          </Tooltip>
        </SlcrStep>
      </div>
      {confirmElement}
    </Modal>
  );
}
