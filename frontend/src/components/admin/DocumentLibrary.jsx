import { useEffect, useRef, useState } from 'react';
import { LibraryAPI, OWNER_FILTERS } from '../../config/libraryApi.js';
import { downloadBlob } from '../../config/api.js';
import Alert from '../ui/Alert.jsx';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { useConfirm } from '../../hooks/useConfirm.jsx';
import { formatDateShort } from '../../utils/date.js';
import {
  getExtension,
  formatFileSize,
  getExtensionBadgeClass,
  getExtensionLabel
} from '../../utils/files.js';
import Icon from '../ms/Icon/Icon.jsx';

/**
 * Knihovna dokumentů - jedna plochá tabulka s filtry.
 *
 * Strom sezóna -> složka -> soubor skončil: soubory se nahrávají u závodu,
 * článku, sezóny nebo klubu a knihovna je jen najde. Zařazení tedy určuje
 * příloha a systematický název, ne ruční přesouvání mezi složkami.
 */

const EMPTY_FILTERS = {
  q: '',
  extension: '',
  owner_type: '',
  date_from: '',
  date_to: ''
};

const hasFilters = (filters) => Object.values(filters).some((value) => value !== '');

/** Starší sezóny se do nabídky nevejdou a nikdo do nich už nic nezveřejňuje. */
const OFFERED_SEASONS = 4;

/** Nabídka přípon se bere z dat, ať tam nejsou volby bez jediného souboru. */
const collectExtensions = (files) => {
  const seen = new Set();
  files.forEach((file) => {
    const ext = getExtension(file.original_filename);
    if (ext) seen.add(ext);
  });
  return Array.from(seen).sort();
};

export default function DocumentLibrary() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [files, setFiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [extensions, setExtensions] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  // Drží se i v refu: Enter potvrdí a políčko zmizí, jenže některé prohlížeče
  // při odebrání zaměřeného prvku ještě pošlou blur - bez téhle pojistky by se
  // přejmenování odeslalo dvakrát.
  const editingRef = useRef(null);
  const { confirm, confirmElement } = useConfirm();

  const filtersActive = hasFilters(applied);

  // Psaní v hledání nesmí posílat request na každý znak.
  useEffect(() => {
    const timer = setTimeout(() => setApplied(filters), 250);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    LibraryAPI.list(applied)
      .then((data) => {
        if (!active) return;
        setFiles(data.files || []);
        setTotal(data.total ?? 0);
        // Jen nefiltrovaný výpis zná všechny přípony; z filtrovaného by se
        // nabídka postupně scvrkla na jedinou položku.
        if (!hasFilters(applied)) setExtensions(collectExtensions(data.files || []));
      })
      .catch((err) => { if (active) setMessage({ type: 'danger', text: err.message }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applied, reloadToken]);

  // Sezóny se nemění během práce s knihovnou, stačí je načíst jednou.
  useEffect(() => {
    let active = true;
    LibraryAPI.seasons()
      .then((data) => { if (active) setSeasons(data || []); })
      .catch((err) => { if (active) setMessage({ type: 'danger', text: err.message }); });
    return () => { active = false; };
  }, []);

  const reload = () => setReloadToken((token) => token + 1);

  const setFilter = (name, value) => setFilters((prev) => ({ ...prev, [name]: value }));

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await LibraryAPI.exportZip(applied);
      downloadBlob(blob, `jmlp-dokumenty-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    } finally {
      setExporting(false);
    }
  };

  // ---- přejmenování přímo v řádku ----

  const startRename = (file) => {
    editingRef.current = file.id;
    setEditingId(file.id);
    setDraftName(file.original_filename || '');
  };

  const cancelRename = () => {
    editingRef.current = null;
    setEditingId(null);
  };

  const commitRename = async (file) => {
    if (editingRef.current !== file.id) return;
    const name = draftName.trim();
    cancelRename();
    if (!name || name === file.original_filename) return;
    try {
      await LibraryAPI.rename(file.id, name);
      setMessage({ type: 'success', text: 'Soubor přejmenován' });
      reload();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  };

  // ---- zveřejnění na webu ----

  /**
   * Připne existující soubor k sezóně jako veřejný dokument.
   *
   * Bez toho by se soubor, který už v knihovně je, musel kvůli zveřejnění
   * nahrávat podruhé - a v knihovně by ležel dvakrát.
   */
  const handlePublish = async (file) => {
    if (!seasons.length) {
      setMessage({ type: 'danger', text: 'Není založená žádná sezóna, kam soubor zveřejnit.' });
      return;
    }

    const year = await confirm({
      title: `Zveřejnit „${file.original_filename}" na webu?`,
      message: 'Soubor se objeví na stránce /dokumenty u vybrané sezóny. '
        + 'Popiskem odkazu je název souboru.',
      choices: seasons.slice(0, OFFERED_SEASONS).map((season) => ({
        value: season.year_start,
        label: `Sezóna ${season.season_label}`,
        variant: 'primary',
        icon: 'globe'
      }))
    });
    if (!year) return;

    try {
      await LibraryAPI.publishToSeason(file.id, year);
      setMessage({ type: 'success', text: 'Soubor zveřejněn na /dokumenty' });
      reload();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  };

  // ---- mazání ----

  const handleDelete = async (file) => {
    const usage = file.usage_info || [];
    const used = usage.length > 0;
    const confirmed = await confirm({
      title: `Smazat „${file.original_filename}"?`,
      message: used
        ? `Soubor je použitý: ${usage.map((item) => `${item.type} – ${item.title}`).join(', ')}. `
          + 'Smazáním zmizí i z těchto míst.'
        : 'Soubor se smaže z knihovny i z disku. Akci nelze vzít zpět.',
      confirmLabel: used ? 'Přesto smazat' : 'Smazat',
      variant: 'danger',
      icon: 'trash'
    });
    if (!confirmed) return;

    try {
      await LibraryAPI.remove(file.id, { force: used });
      setMessage({ type: 'success', text: 'Soubor smazán' });
      reload();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
        <div>
          <h2 className="mb-0">Dokumenty</h2>
          <small className="text-muted">
            Soubory se nahrávají u závodu, článku, sezóny nebo klubu. Tady je najdete
            všechny pohromadě, přejmenujete nebo smažete.
          </small>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary text-nowrap"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? <ButtonSpinner /> : <Icon name="download" className="me-1" />}
          {filtersActive ? 'Stáhnout vyfiltrované' : 'Stáhnout vše'}
        </button>
      </div>

      {message && (
        <Alert
          key={message.text}
          type={message.type}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      )}

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-12 col-lg-4">
              <label className="form-label small mb-1" htmlFor="library-q">Název souboru</label>
              <input
                id="library-q"
                type="search"
                className="form-control"
                placeholder="Hledat v názvech…"
                value={filters.q}
                onChange={(e) => setFilter('q', e.target.value)}
              />
            </div>
            <div className="col-6 col-lg-2">
              <label className="form-label small mb-1" htmlFor="library-extension">Přípona</label>
              <select
                id="library-extension"
                className="form-select"
                value={filters.extension}
                onChange={(e) => setFilter('extension', e.target.value)}
              >
                <option value="">Všechny</option>
                {extensions.map((ext) => (
                  <option key={ext} value={ext}>{ext.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-lg-2">
              <label className="form-label small mb-1" htmlFor="library-owner">Použito</label>
              <select
                id="library-owner"
                className="form-select"
                value={filters.owner_type}
                onChange={(e) => setFilter('owner_type', e.target.value)}
              >
                {OWNER_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-lg-2">
              <label className="form-label small mb-1" htmlFor="library-from">Nahráno od</label>
              <input
                id="library-from"
                type="date"
                className="form-control"
                value={filters.date_from}
                onChange={(e) => setFilter('date_from', e.target.value)}
              />
            </div>
            <div className="col-6 col-lg-2">
              <label className="form-label small mb-1" htmlFor="library-to">Nahráno do</label>
              <input
                id="library-to"
                type="date"
                className="form-control"
                value={filters.date_to}
                onChange={(e) => setFilter('date_to', e.target.value)}
              />
            </div>
          </div>

          <div className="d-flex align-items-center gap-3 mt-2">
            <small className="text-muted">Zobrazeno {files.length} z {total} souborů</small>
            {filtersActive && (
              <button type="button" className="btn btn-link btn-sm p-0" onClick={clearFilters}>
                Zrušit filtry
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && files.length === 0 ? (
        <LoadingState variant="page" label="Načítám knihovnu…" />
      ) : files.length === 0 ? (
        <EmptyState
          icon="folder"
          title={filtersActive ? 'Filtru neodpovídá žádný soubor' : 'Knihovna je prázdná'}
          hint={filtersActive
            ? 'Zkuste jiný výraz nebo zrušte filtry.'
            : 'Soubory se sem dostanou nahráním u závodu, článku, sezóny nebo klubu.'}
        />
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Název</th>
                  <th scope="col" className="text-nowrap">Velikost</th>
                  <th scope="col" className="text-nowrap">Nahráno</th>
                  <th scope="col">Použito</th>
                  <th scope="col" className="text-end">Akce</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className={`badge ${getExtensionBadgeClass(file.original_filename)}`}>
                          {getExtensionLabel(file.original_filename)}
                        </span>
                        {editingId === file.id ? (
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={draftName}
                            autoFocus
                            aria-label="Nový název souboru"
                            onChange={(e) => setDraftName(e.target.value)}
                            onBlur={() => commitRename(file)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename(file);
                              if (e.key === 'Escape') cancelRename();
                            }}
                          />
                        ) : (
                          <a
                            href={file.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-truncate text-decoration-none"
                            title={file.original_filename}
                          >
                            {file.original_filename}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="text-nowrap">{formatFileSize(file.file_size)}</td>
                    <td className="text-nowrap">{formatDateShort(file.uploaded_at)}</td>
                    <td>
                      {file.usage_info?.length > 0 ? (
                        <div className="d-flex flex-wrap gap-1">
                          {file.usage_info.map((item, index) => (
                            <span
                              key={`${item.owner_type}-${item.owner_id}-${item.role}-${index}`}
                              className={`badge ${item.published ? 'bg-success' : 'bg-secondary'}`}
                              title={`${item.type}: ${item.title}`}
                            >
                              {item.type}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted small">Nikde</span>
                      )}
                    </td>
                    <td className="text-end text-nowrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary me-1"
                        onClick={() => startRename(file)}
                        aria-label="Přejmenovat" title="Přejmenovat"
                      >
                        <Icon name="pencil" />
                      </button>
                      <a
                        href={file.download_url}
                        download
                        className="btn btn-sm btn-outline-secondary me-1"
                        aria-label="Stáhnout" title="Stáhnout"
                      >
                        <Icon name="download" />
                      </a>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary me-1"
                        onClick={() => handlePublish(file)}
                        aria-label="Zveřejnit na webu" title="Zveřejnit na webu"
                      >
                        <Icon name="globe" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDelete(file)}
                        aria-label="Smazat" title="Smazat"
                      >
                        <Icon name="trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmElement}
    </div>
  );
}
