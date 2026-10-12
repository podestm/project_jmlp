import { useEffect, useState } from 'react';
import { TimekeeperAPI } from '../../config/timekeeperApi.js';
import { downloadBlob, fetchBlob, timekeeperAuthHeaders } from '../../config/api.js';
import { useConfirm } from '../../hooks/useConfirm.jsx';
import { useRacePdf } from '../../hooks/useRacePdf.js';
import { pdfErrorMessage } from '../../pdf/pdfmake.js';
import { dropRaceSnapshot } from '../../offline/startListCache.js';
import { clearTimingDrafts } from '../../offline/timingDrafts.js';
import { useSyncStatus } from '../../offline/useSyncStatus.js';
import { ButtonSpinner } from '../ui/LoadingState.jsx';
import PdfPreviewModal from './PdfPreviewModal.jsx';
import ResultsPrintButtons from './ResultsPrintButtons.jsx';
import ResultsTable, { CategoryPills } from './ResultsTable.jsx';
import { TK_ACCENT, TK_ACCENT_TEXT } from './TimekeeperChrome.jsx';

export default function ResultsView() {
  const [races, setRaces] = useState([]);
  const [selectedRaceId] = useState(
    localStorage.getItem('timekeeper_selected_race') || ''
  );
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const { confirm, confirmElement } = useConfirm();
  const { isOnline, queueStats } = useSyncStatus();
  const pdf = useRacePdf(selectedRaceId);
  const [clearing, setClearing] = useState(false);

  useEffect(() => { loadRaces(); }, []);

  useEffect(() => {
    if (selectedRaceId) {
      loadResults();
      localStorage.setItem('timekeeper_selected_race', selectedRaceId);
    }
  }, [selectedRaceId]);

  useEffect(() => {
    const categories = results?.categories || [];
    if (!categories.length) {
      setSelectedCategoryId('');
      return;
    }

    const selectedExists = categories.some((cat) => String(cat.category_id) === String(selectedCategoryId));
    if (!selectedExists) {
      setSelectedCategoryId(String(categories[0].category_id));
    }
  }, [results, selectedCategoryId]);

  const loadRaces = async () => {
    try {
      const data = await TimekeeperAPI.get('/api/timekeeper/races');
      setRaces(data);
    } catch (err) { console.error('Failed to load races:', err); }
  };

  const loadResults = async () => {
    if (!selectedRaceId) return;
    try {
      setLoading(true);
      const data = await TimekeeperAPI.get(
        `/api/timekeeper/races/${selectedRaceId}/results`,
        { group_by_category: true }
      );
      setResults(data);
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst výsledky' });
    } finally { setLoading(false); }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const selectedRace = races.find((race) => String(race.id) === String(selectedRaceId));
  const categoryList = results?.categories || [];
  const selectedCategory = categoryList.find(
    (cat) => String(cat.category_id) === String(selectedCategoryId)
  ) || null;

  /** Listina kola jedné kategorie - bez hlavičky, takže funguje i offline. */
  const printCategory = async (runMode) => {
    if (!selectedCategory) return;
    try {
      await pdf.generate({
        categories: [selectedCategory], interim: true, runMode, categoryName: selectedCategory.category_name
      });
    } catch (err) {
      console.error('PDF se nepodařilo vytvořit:', err);
      setMessage({ type: 'danger', text: pdfErrorMessage(err) });
    }
  };

  /** Listina kola všech kategorií. */
  const printAllInterim = async (runMode) => {
    try {
      await pdf.generate({ categories: categoryList, interim: true, runMode });
    } catch (err) {
      console.error('PDF se nepodařilo vytvořit:', err);
      setMessage({ type: 'danger', text: pdfErrorMessage(err) });
    }
  };

  // Výsledky jako FIS XML Dataset pro evidenci SLČR - jeden soubor, všechny
  // kategorie. V evidenci: Tvorba výsledků -> Hromadně nahrát -> FIS XML
  // Dataset, Fiscode = České číslo závodníka. K závodům v akci se výsledky
  // přiřadí podle kodexu (= id kategorie).
  const [slcrDiscipline, setSlcrDiscipline] = useState('');
  const [exportingXml, setExportingXml] = useState(false);
  const exportSlcrXml = async () => {
    if (!selectedRaceId) return;
    setExportingXml(true);
    try {
      const blob = await fetchBlob(`/api/timekeeper/races/${selectedRaceId}/results/fis-xml`, {
        params: slcrDiscipline ? { discipline: slcrDiscipline } : {},
        headers: timekeeperAuthHeaders(),
      });
      const stem = [selectedRace?.datum, selectedRace?.race_nr || `zavod-${selectedRaceId}`].filter(Boolean).join('_');
      downloadBlob(blob, `${stem}_vysledky-slcr.xml`);
    } catch (err) {
      setMessage({ type: 'danger', text: err?.message || 'Export XML se nepodařil' });
    } finally {
      setExportingXml(false);
    }
  };

  const printFinal = async (publishable) => {
    try {
      await pdf.generate({ categories: categoryList, interim: false, publishable });
    } catch (err) {
      console.error('PDF se nepodařilo vytvořit:', err);
      setMessage({ type: 'danger', text: pdfErrorMessage(err) });
    }
  };

  /**
   * Smazání naměřených výsledků.
   *
   * Záměrně jen online: kdyby se tahle operace uložila do offline fronty,
   * přehrála by se třeba za hodinu a smazala i časy naměřené mezitím.
   * Ze stejného důvodu se nepustí, dokud fronta není prázdná - čekající zápis
   * času by se po smazání přehrál a část výsledků vrátil zpátky.
   */
  const clearResults = async () => {
    if (!selectedRaceId) return;

    if (!isOnline) {
      setMessage({
        type: 'warning',
        text: 'Mazání výsledků vyžaduje připojení k internetu - offline by se smazání přehrálo až později a vzalo s sebou i mezitím naměřené časy.'
      });
      return;
    }
    if (queueStats.total > 0) {
      setMessage({
        type: 'warning',
        text: `Ve frontě čeká ${queueStats.total} nesynchronizovaných změn. Nejdřív je nechte odeslat (Sync centrum), jinak by se po smazání přehrály zpátky.`
      });
      return;
    }

    const choice = await confirm({
      title: 'Smazat naměřené výsledky závodu?',
      message: 'Smažou se časy obou kol, příznaky DNF/DNS/DSQ i body u všech závodníků. '
        + 'Startovní listina zůstane, závod se dá měřit znovu bez opakovaného losování. Akce je nevratná.',
      cancelLabel: 'Zrušit',
      choices: [
        { value: 'times', label: 'Smazat naměřené časy', variant: 'danger', icon: 'bi-trash' },
        {
          value: 'all',
          label: 'Smazat časy i publikovanou listinu',
          variant: 'danger',
          icon: 'bi-trash'
        }
      ]
    });
    if (!choice) return;

    try {
      setClearing(true);
      const result = await TimekeeperAPI.deleteOnline(
        `/api/timekeeper/races/${selectedRaceId}/results?published=${choice === 'all'}`
      );
      // Lokální stopy po naměřených časech musí zmizet taky: nakešovaná
      // startovka i rozepsané drafty by je jinak vrátily do hry.
      await dropRaceSnapshot(selectedRaceId);
      await clearTimingDrafts(selectedRaceId);
      setMessage({ type: 'info', text: result.message });
      loadResults();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Výsledky se nepodařilo smazat' });
    } finally {
      setClearing(false);
    }
  };

  /**
   * Pořadí poháru za sezónu vybraného závodu. Počítá ho server ze všech
   * závodů sezóny; závody bez výsledků v aplikaci (měřené jen v LiZe)
   * v něm chybí, a to musí obsluha vědět dřív, než pořadí zveřejní.
   */
  const printStandings = async (final) => {
    if (!selectedRace?.season_id) return;
    try {
      const standings = await pdf.generateStandings({ seasonId: selectedRace.season_id, final });
      const missing = standings?.races_without_results || [];
      if (missing.length) {
        setMessage({
          type: 'warning',
          text: `V pořadí chybí závody bez výsledků v aplikaci: ${missing
            .map((race) => `${race.race_nr} (${formatDate(race.datum)})`)
            .join(', ')}.`
        });
      }
    } catch (err) {
      console.error('PDF se nepodařilo vytvořit:', err);
      setMessage({ type: 'danger', text: pdfErrorMessage(err) });
    }
  };

  const publishResults = async () => {
    const target = pdf.publishTarget;
    const confirmed = await confirm(target?.kind === 'standings' ? {
      title: target.final ? 'Zveřejnit celkové výsledky poháru?' : 'Zveřejnit průběžné výsledky poháru?',
      message: `Pořadí se zveřejní na webu u sezóny ${target.seasonLabel || ''} a nahradí dosavadní průběžné nebo celkové výsledky.`,
      confirmLabel: 'Zveřejnit',
      variant: 'success',
      icon: 'bi-upload'
    } : {
      title: 'Publikovat výsledkovou listinu?',
      message: 'Soubor bude připojen k závodu a zveřejněn na webu. Nahradí dosud publikovanou listinu.',
      confirmLabel: 'Publikovat',
      variant: 'success',
      icon: 'bi-upload'
    });
    if (!confirmed) return;

    try {
      const result = await pdf.publish();
      pdf.closePreview();
      setMessage({ type: 'success', text: result.message });
      loadResults();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="fw-bold mb-0">
            <i className="bi bi-trophy me-2" style={{ color: TK_ACCENT }}></i>
            Výsledky závodu
          </h5>
          <small className="text-muted">Výsledky seřazené podle času, výpočet bodů</small>
        </div>
        {results && results.total_entries > 0 && (
          <div className="d-flex gap-2 flex-wrap">
            <ResultsPrintButtons
              label="Tisk kategorie"
              title="Výsledky kol vybrané kategorie - funguje i offline"
              busy={pdf.generating}
              disabled={!selectedCategory}
              onPrint={printCategory}
            />
            <ResultsPrintButtons
              label="Všechny kategorie"
              title="Výsledky kol všech kategorií - funguje i offline"
              busy={pdf.generating}
              onPrint={printAllInterim}
            />
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => printFinal(false)}
              disabled={pdf.generating}
            >
              <i className="bi bi-file-earmark-pdf me-1"></i>
              Celková listina
            </button>
            <button
              className="btn btn-sm btn-success"
              onClick={() => printFinal(true)}
              disabled={pdf.generating || !isOnline}
              title={isOnline
                ? 'Vygeneruje listinu a nabídne její publikaci k závodu'
                : 'Publikování vyžaduje připojení k internetu'}
            >
              <i className="bi bi-upload me-1"></i>
              Publikovat
            </button>
            <div className="input-group input-group-sm" style={{ width: 'auto' }}>
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: '7.5rem' }}
                value={slcrDiscipline}
                onChange={(e) => setSlcrDiscipline(e.target.value)}
                aria-label="Disciplína pro SLČR"
                title="Disciplína FIS do XML (u suchých závodů lze nechat prázdnou)"
              >
                <option value="">Disciplína –</option>
                <option value="SL">SL</option>
                <option value="GS">GS</option>
                <option value="SG">SG</option>
                <option value="DH">DH</option>
              </select>
              <button
                className="btn btn-outline-secondary"
                onClick={exportSlcrXml}
                disabled={exportingXml || !isOnline}
                title={isOnline
                  ? 'Výsledky jako FIS XML Dataset pro evidenci SLČR (Hromadně nahrát → FIS XML Dataset, Fiscode = České číslo závodníka)'
                  : 'Export vyžaduje připojení k internetu'}
              >
                {exportingXml ? <ButtonSpinner /> : <i className="bi bi-filetype-xml me-1"></i>}
                XML pro SLČR
              </button>
            </div>
            <div className="btn-group btn-group-sm" role="group" aria-label="Pořadí poháru">
              <button
                className="btn btn-outline-secondary"
                onClick={() => printStandings(false)}
                disabled={pdf.generating || !isOnline || !selectedRace?.season_id}
                title={isOnline
                  ? 'Průběžné výsledky poháru za sezónu tohoto závodu'
                  : 'Pořadí poháru vyžaduje připojení k internetu'}
              >
                <i className="bi bi-bar-chart-steps me-1"></i>
                Pohár průběžně
              </button>
              <button
                className="btn btn-outline-secondary"
                onClick={() => printStandings(true)}
                disabled={pdf.generating || !isOnline || !selectedRace?.season_id}
                title={isOnline
                  ? 'Celkové výsledky poháru - po skončení sezóny'
                  : 'Pořadí poháru vyžaduje připojení k internetu'}
              >
                celkově
              </button>
            </div>
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={clearResults}
              disabled={clearing}
              title="Smaže naměřené časy, příznaky a body; startovní listina zůstane"
            >
              {clearing ? <ButtonSpinner /> : <i className="bi bi-trash me-1"></i>}
              Smazat výsledky
            </button>
          </div>
        )}
      </div>

      {/* Race selector */}
      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '10px' }}>
        <div className="card-body py-2 px-3">
          <div className="row align-items-center g-2">
            <div className="col-md-9">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-trophy" style={{ color: TK_ACCENT }}></i>
                <div className="form-control form-control-sm d-flex align-items-center" style={{ borderRadius: '8px', minHeight: '38px', background: '#fff' }}>
                  {selectedRace
                    ? `${selectedRace.race_nr || `#${selectedRace.id}`} — ${selectedRace.areal_name || '?'} (${formatDate(selectedRace.datum)})`
                    : 'Závod vyberte v Přehledu závodů'}
                </div>
              </div>
            </div>
            {results && (
              <div className="col-md-3 text-end">
                <small className="text-muted">Závodníků: </small>
                <span className="fw-bold" style={{ color: TK_ACCENT_TEXT }}>{results.total_entries}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className={`alert alert-${message.type} py-2 d-flex align-items-center small`} role="alert">
          <i className={`bi ${message.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
          {message.text}
          <button type="button" className="btn-close ms-auto" style={{ fontSize: '0.7rem' }} onClick={() => setMessage(null)}></button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-4">
          <div className="spinner-border spinner-border-sm" style={{ color: TK_ACCENT }}></div>
        </div>
      )}

      {!loading && results && categoryList.length > 0 && (
        <CategoryPills
          categories={categoryList}
          selectedId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
        />
      )}

      {!loading && selectedCategory && (
        <div className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
          <div className="card-header bg-white py-2 px-3" style={{ borderRadius: '10px 10px 0 0', borderBottom: '2px solid #e94560' }}>
            <small className="fw-bold">
              <i className="bi bi-tag-fill me-1" style={{ color: TK_ACCENT }}></i>
              {selectedCategory.category_name}
              <span className="badge bg-secondary ms-1" style={{ fontSize: '0.65rem' }}>{selectedCategory.entries.length}</span>
            </small>
          </div>
          <div className="card-body p-0">
            <ResultsTable entries={selectedCategory.entries} showPoints />
          </div>
        </div>
      )}

      {/* Empty states */}
      {!loading && results && results.total_entries === 0 && (
        <div className="text-center py-4">
          <i className="bi bi-trophy text-muted" style={{ fontSize: '2rem' }}></i>
          <p className="text-muted mt-2 mb-0 small">Žádné výsledky</p>
          <small className="text-muted">Nejprve zadejte časy závodníkům</small>
        </div>
      )}

      {!selectedRaceId && (
        <div className="text-center py-4">
          <i className="bi bi-hand-index text-muted" style={{ fontSize: '2rem' }}></i>
          <p className="text-muted mt-2 small">Vyberte závod pro zobrazení výsledků</p>
        </div>
      )}

      {pdf.objectUrl && (
        <PdfPreviewModal
          objectUrl={pdf.objectUrl}
          title={pdf.previewTitle}
          canPublish={pdf.canPublish}
          publishLabel={pdf.publishTarget?.kind === 'standings' ? 'Zveřejnit u sezóny' : 'Publikovat k závodu'}
          publishing={pdf.publishing}
          onPublish={publishResults}
          onClose={pdf.closePreview}
        />
      )}
      {confirmElement}
    </div>
  );
}
