import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadBlob } from '../config/api.js';
import { timekeeperAuthHeaders } from '../config/api.js';
import { TimekeeperAPI } from '../config/timekeeperApi.js';
import { createPdfBlob } from '../pdf/pdfmake.js';
import { buildResultsDoc, resultsFileName, TITLE_FINAL, TITLE_INTERIM } from '../pdf/resultsPdf.js';
import { loadHeaderLogos } from '../pdf/assets.js';
import { rankEntriesByTime } from '../components/timekeeper/ResultsTable.jsx';

/**
 * Generování, náhled a publikace výsledkové listiny.
 *
 * PDF vzniká v prohlížeči, takže tisk průběžných výsledků funguje i offline -
 * data jsou nakešovaná v IndexedDB a pořadí i body se počítají lokálně
 * (rankEntriesByTime + utils/points.js).
 *
 * Publikace naopak online být musí a nikdy nesmí do offline fronty: vyřízená
 * hodiny stará operace by se přehrála proti jinému stavu serveru.
 */
export function useResultsPdf(raceId) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [canPublish, setCanPublish] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const blobRef = useRef(null);
  const fileNameRef = useRef('vysledky.pdf');

  const closePreview = useCallback(() => {
    setObjectUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    blobRef.current = null;
  }, []);

  // Blob URL by jinak přežil odchod z obrazovky.
  useEffect(() => closePreview, [closePreview]);

  /** Hlavička se čte zvlášť; offline se vezme z IndexedDB. */
  const loadHeader = useCallback(async () => {
    try {
      const detail = await TimekeeperAPI.get(`/api/timekeeper/races/${raceId}/detail`);
      const logos = await loadHeaderLogos(detail.organizer_logo_url);
      return {
        ...logos,
        raceNumberLabel: detail.race_number_label,
        seasonName: detail.season_name,
        editionLabel: detail.edition_label,
        raceDirector: detail.race_director,
        technicalDelegate: detail.technical_delegate,
        chiefTimekeeper: detail.chief_timekeeper,
        organizerName: detail.organizer_name,
        arealName: detail.areal_name,
        raceDate: detail.datum,
        runs: detail.runs || [],
        runCount: detail.run_count || 1
      };
    } catch {
      return null;
    }
  }, [raceId]);

  /**
   * @param {object}  options
   * @param {Array}   options.categories  kategorie k vytištění
   * @param {boolean} options.interim     true = bez hlavičky (průběžné)
   * @param {boolean} options.publishable povolit tlačítko Publikovat
   */
  const generate = useCallback(async ({ categories, interim, publishable = false }) => {
    setGenerating(true);
    try {
      const header = interim ? null : await loadHeader();
      const runCount = header?.runCount
        || (categories.some((c) => c.entries.some((e) => e.time2 != null)) ? 2 : 1);

      // Pořadí a body se dopočítají lokálně, ať sedí i pro dosud
      // nesynchronizované časy.
      const ranked = categories.map((category) => ({
        ...category,
        entries: rankEntriesByTime(category.entries)
      }));

      const doc = buildResultsDoc({
        header,
        categories: ranked,
        title: interim ? TITLE_INTERIM : TITLE_FINAL,
        runCount
      });

      const blob = await createPdfBlob(doc);
      blobRef.current = blob;
      fileNameRef.current = resultsFileName(header?.raceNumberLabel, interim);

      closePreview();
      setObjectUrl(URL.createObjectURL(blob));
      setPreviewTitle(interim ? 'Průběžné výsledky' : 'Celková výsledková listina');
      setCanPublish(publishable && !interim);
    } finally {
      setGenerating(false);
    }
  }, [loadHeader, closePreview]);

  const download = useCallback(() => {
    if (blobRef.current) downloadBlob(blobRef.current, fileNameRef.current);
  }, []);

  /** Nahraje vygenerované PDF na server a připojí ho k závodu. */
  const publish = useCallback(async () => {
    if (!blobRef.current) throw new Error('Nejdřív vygenerujte listinu.');
    setPublishing(true);
    try {
      const formData = new FormData();
      formData.append('file', blobRef.current, fileNameRef.current);

      // Záměrně holý fetch - publikace nesmí do offline fronty.
      const response = await fetch(
        `/api/timekeeper/races/${raceId}/results/publish`,
        { method: 'POST', headers: timekeeperAuthHeaders(), body: formData }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || 'Publikace se nezdařila');
      }
      return response.json();
    } finally {
      setPublishing(false);
    }
  }, [raceId]);

  return {
    objectUrl,
    previewTitle,
    canPublish,
    generating,
    publishing,
    generate,
    download,
    publish,
    closePreview
  };
}
