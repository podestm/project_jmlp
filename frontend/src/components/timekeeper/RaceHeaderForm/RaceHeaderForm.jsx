import { Button, Field, Input, LoadingState, PageHeader, Paska } from '../../ms/index.js';
import NoRaceSelected from '../frame/NoRaceSelected/NoRaceSelected.jsx';
import { useSelectedRaceId } from '../frame/selectedRace.js';
import TkPage from '../frame/TkPage/TkPage.jsx';
import TimekeeperMessage from '../TimekeeperMessage.jsx';
import AutoFilledPanel from './AutoFilledPanel.jsx';
import RunPanel from './RunPanel.jsx';
import { useRaceHeader } from './useRaceHeader.js';
import styles from './RaceHeaderForm.module.css';

const OFFICIALS = [
  { key: 'race_director', label: 'Ředitel závodu', hint: 'Podepisuje výsledkovou listinu.' },
  { key: 'technical_delegate', label: 'Technický delegát (TD)', hint: 'Deleguje komisař soutěže.' },
  { key: 'chief_timekeeper', label: 'Hlavní časoměřič', hint: 'Tiskne se v hlavičce.' },
];

/**
 * Detail závodu (TkHlavickaZavodu): údaje do hlavičky výsledkové listiny.
 * Vyplňují se před závodem; počet kol se nenastavuje – listina se řídí
 * naměřenými daty a tiskne jen vyplněné kolo.
 */
export default function RaceHeaderForm() {
  // Závod se vybírá v Přehledu, tady se jen čte.
  const raceId = useSelectedRaceId();
  const { detail, form, loading, saving, message, clearMessage, setField, setRunField, save } = useRaceHeader(raceId);

  const handleSubmit = (e) => {
    e.preventDefault();
    save();
  };

  const body = () => {
    if (!raceId) return <NoRaceSelected />;
    if (loading || !form) return <LoadingState label="Načítám údaje závodu…" />;
    return (
      <form className={styles.layout} onSubmit={handleSubmit}>
        <div className={styles.main}>
          <section className={styles.section}>
            <Paska>Funkcionáři závodu</Paska>
            <div className={styles.officials}>
              {OFFICIALS.map((official) => (
                <Field key={official.key} label={official.label} hint={official.hint} id={`hlavicka-${official.key}`}>
                  <Input value={form[official.key]} onChange={(e) => setField(official.key, e.target.value)} />
                </Field>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <Paska aside="Každé kolo má vlastní stavitele, branky a podmínky.">Parametry kol</Paska>
            {form.runs.map((run) => <RunPanel key={run.run_number} run={run} onChange={setRunField} />)}
          </section>

          <div className={styles.saveBar}>
            <p className={styles.saveNote}>
              Hlavička se ukládá zvlášť od časů. Offline se uloží do notebooku a odejde s frontou.
            </p>
            <Button type="submit" variant="primary" size="lg" icon="save" busy={saving}>Uložit údaje závodu</Button>
          </div>
        </div>

        {detail && <AutoFilledPanel detail={detail} />}
      </form>
    );
  };

  return (
    <TkPage>
      <PageHeader
        variant="app"
        title="Detail závodu"
        meta="Tohle se vytiskne nahoru na výsledkovou listinu. Vyplňte, co víte – zbytek jde doplnit i po závodě."
      />
      <TimekeeperMessage message={message} onDismiss={clearMessage} />
      {body()}
    </TkPage>
  );
}
