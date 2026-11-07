import { useEffect, useRef, useState } from 'react';
import { LibraryAPI } from '../../../config/libraryApi.js';
import { downloadBlob } from '../../../config/api.js';
import { collectExtensions, EMPTY_FILTERS, hasFilters } from './documents.js';
import { deleteFileConfirm } from './dialogs/deleteFileConfirm.jsx';

/**
 * Data a akce knihovny dokumentů: filtry s prodlevou, výpis, export ZIP,
 * přejmenování v řádku, zveřejnění u sezóny a mazání.
 *
 * Strom sezóna -> složka -> soubor skončil: soubory se nahrávají u závodu,
 * článku, sezóny nebo klubu a knihovna je jen najde. Zařazení tedy určuje
 * příloha a systematický název, ne ruční přesouvání mezi složkami.
 *
 * @param {{confirm: Function}} options - confirm z useConfirm komponenty
 */
export function useDocumentLibrary({ confirm }) {
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
  // Soubor, který se právě zveřejňuje (AdminDialogZverejnitSoubor).
  const [publishing, setPublishing] = useState(null);
  // Drží se i v refu: Enter potvrdí a políčko zmizí, jenže některé prohlížeče
  // při odebrání zaměřeného prvku ještě pošlou blur - bez téhle pojistky by se
  // přejmenování odeslalo dvakrát.
  const editingRef = useRef(null);

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
      .catch((err) => {
        if (active) setMessage({ type: 'danger', text: err.message });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applied, reloadToken]);

  // Sezóny se nemění během práce s knihovnou, stačí je načíst jednou.
  useEffect(() => {
    let active = true;
    LibraryAPI.seasons()
      .then((data) => {
        if (active) setSeasons(data || []);
      })
      .catch((err) => {
        if (active) setMessage({ type: 'danger', text: err.message });
      });
    return () => {
      active = false;
    };
  }, []);

  const reload = () => setReloadToken((token) => token + 1);

  const setFilter = (name, value) => setFilters((prev) => ({ ...prev, [name]: value }));

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  };

  const exportZip = async () => {
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
   * Otevře výběr sezóny. Připnutím k sezóně se existující soubor objeví na
   * /dokumenty – bez toho by se kvůli zveřejnění nahrával podruhé a v knihovně
   * by ležel dvakrát.
   */
  const requestPublish = (file) => {
    if (!seasons.length) {
      setMessage({ type: 'danger', text: 'Není založená žádná sezóna, kam soubor zveřejnit.' });
      return;
    }
    setPublishing(file);
  };

  const publish = async (year) => {
    const file = publishing;
    setPublishing(null);
    try {
      await LibraryAPI.publishToSeason(file.id, year);
      setMessage({ type: 'success', text: 'Soubor zveřejněn na /dokumenty' });
      reload();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  };

  // ---- mazání ----

  const deleteFile = async (file) => {
    const used = (file.usage_info || []).length > 0;
    if (!(await confirm(deleteFileConfirm(file)))) return;

    try {
      await LibraryAPI.remove(file.id, { force: used });
      setMessage({ type: 'success', text: 'Soubor smazán' });
      reload();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  };

  return {
    filters,
    setFilter,
    clearFilters,
    filtersActive,
    files,
    total,
    extensions,
    seasons,
    loading,
    exporting,
    exportZip,
    message,
    setMessage,
    editingId,
    draftName,
    setDraftName,
    startRename,
    cancelRename,
    commitRename,
    publishing,
    requestPublish,
    publish,
    cancelPublish: () => setPublishing(null),
    deleteFile,
  };
}
