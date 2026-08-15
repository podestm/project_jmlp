import { useEffect, useState } from 'react';
import { TimekeeperAPI } from '../../config/timekeeperApi.js';
import { useConfirm } from '../../hooks/useConfirm.jsx';
import { useResultsPdf } from '../../hooks/useResultsPdf.js';
import { useSyncStatus } from '../../offline/useSyncStatus.js';
import { ButtonSpinner } from '../ui/LoadingState.jsx';
import ResultsPdfPreviewModal from './ResultsPdfPreviewModal.jsx';
import ResultsTable, { CategoryPills } from './ResultsTable.jsx';

export default function ResultsView() {
  const [races, setRaces] = useState([]);
  const [selectedRaceId] = useState(
    localStorage.getItem('timekeeper_selected_race') || ''
  );
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const { confirm, confirmElement } = useConfirm();
  const { isOnline } = useSyncStatus();
  const pdf = useResultsPdf(selectedRaceId);

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

  const calculatePoints = async () => {
    if (!selectedRaceId) return;
    try {
      setCalculating(true);
      const result = await TimekeeperAPI.post(`/api/timekeeper/races/${selectedRaceId}/results/calculate-points`);
      setMessage({ type: 'success', text: result.message });
      loadResults();
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se vypočítat body' });
    } finally { setCalculating(false); }
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

  /** Průběžné pořadí jedné kategorie - bez hlavičky, takže funguje i offline. */
  const printCategory = async () => {
    if (!selectedCategory) return;
    try {
      await pdf.generate({ categories: [selectedCategory], interim: true });
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se vytvořit PDF' });
    }
  };

  const printFinal = async (publishable) => {
    try {
      await pdf.generate({ categories: categoryList, interim: false, publishable });
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se vytvořit PDF' });
    }
  };

  const publishResults = async () => {
    const confirmed = await confirm({
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
            <i className="bi bi-trophy me-2" style={{ color: '#e94560' }}></i>
            Výsledky závodu
          </h5>
          <small className="text-muted">Výsledky seřazené podle času, výpočet bodů</small>
        </div>
        {results && results.total_entries > 0 && (
          <div className="d-flex gap-2 flex-wrap">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={printCategory}
              disabled={pdf.generating || !selectedCategory}
              title="Průběžné výsledky vybrané kategorie - funguje i offline"
            >
              {pdf.generating ? <ButtonSpinner /> : <i className="bi bi-printer me-1"></i>}
              Tisk kategorie
            </button>
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
            <button
              className="btn btn-sm text-white"
              style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '8px' }}
              onClick={calculatePoints}
              disabled={calculating}
            >
              {calculating ? (
                <><ButtonSpinner />Počítám...</>
              ) : (
                <><i className="bi bi-calculator me-1"></i>Vypočítat body</>
              )}
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
                <i className="bi bi-trophy" style={{ color: '#e94560' }}></i>
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
                <span className="fw-bold" style={{ color: '#e94560' }}>{results.total_entries}</span>
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
          <div className="spinner-border spinner-border-sm" style={{ color: '#e94560' }}></div>
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
              <i className="bi bi-tag-fill me-1" style={{ color: '#e94560' }}></i>
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
        <ResultsPdfPreviewModal
          objectUrl={pdf.objectUrl}
          title={pdf.previewTitle}
          canPublish={pdf.canPublish}
          publishing={pdf.publishing}
          onPublish={publishResults}
          onDownload={pdf.download}
          onClose={pdf.closePreview}
        />
      )}
      {confirmElement}
    </div>
  );
}
