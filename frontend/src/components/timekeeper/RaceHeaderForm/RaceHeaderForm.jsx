import {
  Button,
  EmptyState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Paska,
  Tooltip,
} from '../../ms/index.js';
import NoRaceSelected from '../frame/NoRaceSelected/NoRaceSelected.jsx';
import { useSelectedRaceId } from '../frame/selectedRace.js';
import TkPage from '../frame/TkPage/TkPage.jsx';
import TimekeeperMessage from '../TimekeeperMessage.jsx';
import AutoFilledPanel from './AutoFilledPanel.jsx';
import RunPanel from './RunPanel.jsx';
import { useRaceHeader } from './useRaceHeader.js';
import styles from './RaceHeaderForm.module.css';

const OFFICIALS = [
  { key: 'race_director', label: 'Ředitel závodu' },
  { key: 'technical_delegate', label: 'Technický delegát (TD)' },
  { key: 'chief_timekeeper', label: 'Hlavní časoměřič' },
];

/**
 * Detail závodu (TkHlavickaZavodu): údaje do hlavičky výsledkové listiny.
 * Vyplňují se před závodem; počet kol se nenastavuje – listina se řídí
 * naměřenými daty a tiskne jen vyplněné kolo.
 */
export default function RaceHeaderForm() {
  // Závod se vybírá v Přehledu, tady se jen čte.
  const raceId = useSelectedRaceId();
  const {
    detail,
    form,
    loading,
    saving,
    message,
    clearMessage,
    unavailable,
    reload,
    setField,
    setRunField,
    save,
  } = useRaceHeader(raceId);

  const handleSubmit = (e) => {
    e.preventDefault();
    save();
  };

  const body = () => {
    if (!raceId) return <NoRaceSelected />;
    if (!form && unavailable && !loading) {
      return (
        <EmptyState
          icon="wifi-off"
          title="Údaje závodu nejsou v zařízení"
          action={
            <Button size="sm" icon="refresh" onClick={reload}>
              Zkusit znovu
            </Button>
          }
        />
      );
    }
    if (loading || !form) return <LoadingState label="Načítám údaje závodu…" />;
    return (
      <form className={styles.layout} onSubmit={handleSubmit}>
        <div className={styles.main}>
          <section className={styles.section}>
            <Paska>Funkcionáři závodu</Paska>
            <div className={styles.officials}>
              {OFFICIALS.map((official) => (
                <Field key={official.key} label={official.label} id={`hlavicka-${official.key}`}>
                  <Input
                    value={form[official.key]}
                    onChange={(e) => setField(official.key, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <Paska>Parametry kol</Paska>
            {form.runs.map((run) => (
              <RunPanel key={run.run_number} run={run} onChange={setRunField} />
            ))}
          </section>

          <div className={styles.saveBar}>
            <Tooltip text="Offline odejde s frontou">
              <Button type="submit" variant="primary" size="lg" icon="save" busy={saving}>
                Uložit údaje závodu
              </Button>
            </Tooltip>
          </div>
        </div>

        {detail && <AutoFilledPanel detail={detail} />}
      </form>
    );
  };

  return (
    <TkPage>
      <PageHeader variant="app" title="Detail závodu" />
      <TimekeeperMessage message={message} onDismiss={clearMessage} />
      {body()}
    </TkPage>
  );
}
