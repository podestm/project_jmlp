import { useConfirm } from '../../../hooks/useConfirm.jsx';
import { Button, EmptyState, LoadingState, PageHeader, Paska, Tooltip } from '../../ms/index.js';
import TkPage from '../frame/TkPage/TkPage.jsx';
import TimekeeperMessage from '../TimekeeperMessage.jsx';
import NewSetForm from './NewSetForm.jsx';
import NumberSetCard from './NumberSetCard.jsx';
import { setsSummary } from './raceNumberSets.js';
import { useRaceNumbers } from './useRaceNumbers.js';
import styles from './RaceNumbersManager.module.css';

const plural = (n, [one, few, many]) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

/**
 * Startovní čísla (TkCisla): sady dresů s jejich barvou, rozsahem
 * a mřížkou čísel; nová sada v pravém sloupci. S vybraným závodem
 * obrazovka nepracuje – sady platí pro celou sezónu.
 */
export default function RaceNumbersManager() {
  const { confirm, confirmElement } = useConfirm();
  const numbersApi = useRaceNumbers({ confirm });
  const { sets, loading, message, clearMessage, showSetForm, setShowSetForm } = numbersApi;
  const summary = setsSummary(sets);

  return (
    <TkPage>
      <PageHeader
        variant="app"
        title="Startovní čísla"
        actions={(
          <Tooltip text="Sady platí pro celou sezónu">
            <Button variant="primary" icon={showSetForm ? 'close' : 'plus'} aria-expanded={showSetForm} onClick={() => setShowSetForm(!showSetForm)}>
              {showSetForm ? 'Zrušit' : 'Nová sada'}
            </Button>
          </Tooltip>
        )}
      />

      <TimekeeperMessage message={message} onDismiss={clearMessage} />

      {loading ? (
        <LoadingState label="Načítám sady čísel…" />
      ) : (
        <div className={showSetForm ? styles.withForm : undefined}>
          <section className={styles.sets} aria-labelledby="sady-dresu">
            <Paska
              id="sady-dresu"
              aside={sets.length > 0 && `${summary.sets} ${plural(summary.sets, ['sada', 'sady', 'sad'])} · ${summary.total} čísel celkem · ${summary.active} aktivních`}
            >
              Sady dresů
            </Paska>
            {sets.length > 0 ? (
              sets.map((set) => <NumberSetCard key={set.set_number} set={set} numbersApi={numbersApi} />)
            ) : (
              <EmptyState icon="numbers" title="Žádné sady startovních čísel" />
            )}
          </section>
          {showSetForm && <NewSetForm numbersApi={numbersApi} />}
        </div>
      )}

      {confirmElement}
    </TkPage>
  );
}
