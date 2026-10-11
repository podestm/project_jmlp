import { useCallback, useEffect, useState } from 'react';
import { TimekeeperAPI } from '../../config/timekeeperApi.js';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { readSelectedRaceId } from './frame/selectedRace.js';
import { SelectedRaceBar } from './TimekeeperChrome.jsx';
import TimekeeperMessage from './TimekeeperMessage.jsx';
import Icon from '../ms/Icon/Icon.jsx';

/**
 * Údaje závodu do hlavičky výsledkové listiny.
 *
 * Vyplňují se před závodem. GET se ukládá do IndexedDB, takže hlavička je
 * k dispozici i při tisku bez připojení.
 *
 * Počet kol se tady nenastavuje: jedna kategorie může jet obě kola a jiná jen
 * jedno, takže by to byl údaj, který za celý závod nemůže platit. Listina se
 * řídí naměřenými daty a do hlavičky se tiskne jen to kolo, které je vyplněné.
 */

/** Obě kola se nabízejí vždy; nevyplněné se do listiny netiskne. */
const RUN_NUMBERS = [1, 2];

const emptyRun = (runNumber) => ({
  run_number: runNumber,
  course_setter: '',
  gates_count: '',
  conditions: '',
  start_time: '',
  course_length_m: ''
});

const toFormRun = (run) => ({
  run_number: run.run_number,
  course_setter: run.course_setter ?? '',
  gates_count: run.gates_count ?? '',
  conditions: run.conditions ?? '',
  start_time: run.start_time ?? '',
  course_length_m: run.course_length_m ?? ''
});

export default function RaceHeaderForm() {
  const [races, setRaces] = useState([]);
  // Závod se vybírá v Přehledu, tady se jen čte - stejně jako ve Výsledcích.
  const [selectedRaceId] = useState(readSelectedRaceId);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    TimekeeperAPI.get('/api/timekeeper/races')
      .then(setRaces)
      .catch(() => setMessage({ type: 'danger', text: 'Nepodařilo se načíst závody' }));
  }, []);

  const loadDetail = useCallback(async () => {
    if (!selectedRaceId) return;
    try {
      setLoading(true);
      const data = await TimekeeperAPI.get(`/api/timekeeper/races/${selectedRaceId}/detail`);
      setDetail(data);

      const runs = RUN_NUMBERS.map((runNumber) => {
        const existing = data.runs.find((run) => run.run_number === runNumber);
        return existing ? toFormRun(existing) : emptyRun(runNumber);
      });
      setForm({
        race_director: data.race_director ?? '',
        technical_delegate: data.technical_delegate ?? '',
        chief_timekeeper: data.chief_timekeeper ?? '',
        runs
      });
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst údaje závodu' });
    } finally {
      setLoading(false);
    }
  }, [selectedRaceId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const updateRun = (runNumber, field, value) => {
    setForm((prev) => ({
      ...prev,
      runs: prev.runs.map((run) =>
        run.run_number === runNumber ? { ...run, [field]: value } : run)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        race_director: form.race_director.trim() || null,
        technical_delegate: form.technical_delegate.trim() || null,
        chief_timekeeper: form.chief_timekeeper.trim() || null,
        runs: form.runs.map((run) => ({
          run_number: run.run_number,
          course_setter: String(run.course_setter).trim() || null,
          gates_count: run.gates_count === '' ? null : Number(run.gates_count),
          conditions: String(run.conditions).trim() || null,
          start_time: String(run.start_time).trim() || null,
          course_length_m: run.course_length_m === '' ? null : Number(run.course_length_m)
        }))
      };
      const updated = await TimekeeperAPI.put(
        `/api/timekeeper/races/${selectedRaceId}/detail`, payload);
      setDetail(updated);
      setMessage({ type: 'success', text: 'Údaje závodu uloženy' });
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Uložení se nezdařilo' });
    } finally {
      setSaving(false);
    }
  };

  const selectedRace = races.find((race) => String(race.id) === String(selectedRaceId));

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0"><Icon name="card" className="me-2" />Údaje závodu</h5>
      </div>

      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '10px' }}>
        <div className="card-body py-2 px-3">
          <SelectedRaceBar race={selectedRace} />
        </div>
      </div>

      <TimekeeperMessage message={message} onDismiss={() => setMessage(null)} />

      {!selectedRaceId ? (
        <EmptyState
          icon="card"
          title="Vyberte závod"
          hint="Závod vyberte v Přehledu závodů."
        />
      ) : loading || !form ? (
        <LoadingState variant="timekeeper" label="Načítám údaje závodu…" />
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span><Icon name="card" className="me-2" />Hlavička výsledkové listiny</span>
              <small className="text-muted">
                {detail?.race_number_label}
                {detail?.edition_label ? ` · ${detail.edition_label} ročník` : ''}
              </small>
            </div>
            <div className="card-body">
              <div className="alert alert-light border small mb-3">
                <strong>Z databáze se doplní automaticky:</strong>{' '}
                číslo závodu <code>{detail?.race_number_label || '—'}</code>,
                {' '}pořadatel <code>{detail?.organizer_name || '—'}</code>,
                {' '}místo a datum <code>{detail?.areal_name || '—'}</code>.
                {!detail?.organizer_logo_url && (
                  <div className="mt-1 text-warning-emphasis">
                    <Icon name="warning" className="me-1" />
                    Pořádající klub nemá nahrané logo — v hlavičce bude logo JMLP.
                  </div>
                )}
              </div>

              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label">Ředitel závodu</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.race_director}
                    onChange={(e) => setForm({ ...form, race_director: e.target.value })}
                  />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Technický delegát (TD)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.technical_delegate}
                    onChange={(e) => setForm({ ...form, technical_delegate: e.target.value })}
                  />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Hlavní časoměřič</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.chief_timekeeper}
                    onChange={(e) => setForm({ ...form, chief_timekeeper: e.target.value })}
                  />
                </div>
              </div>

            </div>
          </div>

          {form.runs.map((run) => (
            <div className="card mb-3" key={run.run_number}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <span><Icon name="flag" className="me-2" />{run.run_number}. KOLO</span>
                <small className="text-muted">Nevyplněné kolo se do hlavičky netiskne</small>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Stavitel trati</label>
                    <input
                      type="text"
                      className="form-control"
                      value={run.course_setter}
                      onChange={(e) => updateRun(run.run_number, 'course_setter', e.target.value)}
                    />
                  </div>
                  <div className="col-md-2 mb-3">
                    <label className="form-label">Branek</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      value={run.gates_count}
                      onChange={(e) => updateRun(run.run_number, 'gates_count', e.target.value)}
                    />
                  </div>
                  <div className="col-md-3 mb-3">
                    <label className="form-label">Podmínky</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="např. zataženo"
                      value={run.conditions}
                      onChange={(e) => updateRun(run.run_number, 'conditions', e.target.value)}
                    />
                  </div>
                  <div className="col-md-3 mb-3">
                    <label className="form-label">Čas startu</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="10:00"
                      value={run.start_time}
                      onChange={(e) => updateRun(run.run_number, 'start_time', e.target.value)}
                    />
                  </div>
                  <div className="col-md-3 mb-3">
                    <label className="form-label">Délka trati</label>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        min="0"
                        value={run.course_length_m}
                        onChange={(e) => updateRun(run.run_number, 'course_length_m', e.target.value)}
                      />
                      <span className="input-group-text">m</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <ButtonSpinner /> : <Icon name="check" className="me-1" />}
            Uložit údaje závodu
          </button>
        </form>
      )}
    </div>
  );
}
